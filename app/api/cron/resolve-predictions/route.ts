export const dynamic = 'force-dynamic'
export const maxDuration = 60

import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Decimal } from 'decimal.js'

const CLOB_BASE = 'https://clob.polymarket.com'

interface CLOBMarketStatus {
  condition_id: string
  closed: boolean
  active: boolean
  tokens: Array<{ token_id: string; outcome: string; price: number }>
}

// Called hourly by Vercel Cron. Protected by CRON_SECRET.
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authHeader = req.headers.get('authorization')
  const expected = `Bearer ${cronSecret}`
  let authorized = false
  try {
    authorized =
      authHeader !== null &&
      authHeader.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  } catch {
    authorized = false
  }
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find all open prediction holdings
  const holdings = await db.holding.findMany({
    where: { assetType: 'PREDICTION' },
    include: { account: true },
  })

  if (holdings.length === 0) {
    return NextResponse.json({ ok: true, settled: 0, checked: 0 })
  }

  // Deduplicate conditionIds
  const uniqueConditionIds = [
    ...new Set(holdings.map(h => h.symbol.split(':')[0])),
  ]

  // Fetch market status for each conditionId
  const marketStatuses = new Map<string, CLOBMarketStatus>()
  await Promise.allSettled(
    uniqueConditionIds.map(async conditionId => {
      try {
        const res = await fetch(`${CLOB_BASE}/markets/${conditionId}`, { cache: 'no-store' })
        if (!res.ok) return
        const market: CLOBMarketStatus = await res.json()
        marketStatuses.set(conditionId, market)
      } catch {
        // Skip markets that fail to fetch — retry on next cron run
      }
    })
  )

  let settled = 0
  const errors: string[] = []

  for (const holding of holdings) {
    const conditionId = holding.symbol.split(':')[0]
    const side = holding.symbol.split(':')[1] ?? 'YES'
    const market = marketStatuses.get(conditionId)

    if (!market?.closed) continue  // Market still active

    // Determine settlement price
    const yesToken = market.tokens.find(t => t.outcome === 'Yes')
    const noToken = market.tokens.find(t => t.outcome === 'No')

    // On Polymarket: resolved YES token → price ~1.0, resolved NO token → price ~0.0
    const resolvedYes = yesToken ? yesToken.price > 0.99 : false
    const settlementPrice = side === 'YES'
      ? (resolvedYes ? 1.0 : 0.0)
      : (resolvedYes ? 0.0 : 1.0)

    const quantity = new Decimal(holding.quantity)
    const totalValue = quantity.mul(settlementPrice)
    const costBasis = new Decimal(holding.avgCostBasis)
    const realizedPnl = totalValue.minus(quantity.mul(costBasis))

    try {
      await db.$transaction(async tx => {
        // Record a SELL trade at settlement price
        await tx.trade.create({
          data: {
            accountId: holding.accountId,
            symbol: holding.symbol,
            assetType: 'PREDICTION',
            assetName: `${conditionId.slice(0, 10)}... (settled)`,
            side: 'SELL',
            quantity: quantity.abs(),
            price: new Decimal(settlementPrice),
            totalValue,
            reason: `Market resolved: ${resolvedYes ? 'YES' : 'NO'}`,
          },
        })

        // Credit cash (NO tokens that resolved worthless credit $0)
        if (totalValue.greaterThan(0)) {
          await tx.paperAccount.update({
            where: { id: holding.accountId },
            data: {
              cashBalance: {
                increment: totalValue.toNumber(),
              },
            },
          })
        }

        // Update realized P&L and remove holding
        await tx.holding.update({
          where: { id: holding.id },
          data: {
            realizedPnl: new Decimal(holding.realizedPnl).plus(realizedPnl),
            quantity: new Decimal(0),
          },
        })

        // Delete zero-quantity holding
        await tx.holding.delete({ where: { id: holding.id } })
      })

      settled++
    } catch (err) {
      errors.push(`${holding.symbol}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    ok: true,
    checked: uniqueConditionIds.length,
    settled,
    errors,
    timestamp: new Date().toISOString(),
  })
}
