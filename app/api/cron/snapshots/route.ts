export const dynamic = 'force-dynamic'
export const maxDuration = 60 // seconds — Vercel hobby plan max

import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getQuote } from '@/lib/market-data'
import type { AssetType } from '@/types'

// Called daily by Vercel Cron. Protected by CRON_SECRET.
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authHeader = req.headers.get('authorization')
  const expected = `Bearer ${cronSecret}`
  let authorized = false
  try {
    authorized = authHeader !== null &&
      authHeader.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  } catch {
    authorized = false
  }
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accounts = await db.paperAccount.findMany({
    include: { holdings: true },
  })

  let saved = 0
  let failed = 0

  for (const account of accounts) {
    try {
      const cashBalance = Number(account.cashBalance)

      // Fetch current prices for all holdings in parallel
      const priceResults = await Promise.allSettled(
        account.holdings.map(h => getQuote(h.symbol, h.assetType as AssetType))
      )

      const holdingsValue = account.holdings.reduce((sum, h, i) => {
        const result = priceResults[i]
        const price = result.status === 'fulfilled'
          ? result.value.price
          : Number(h.avgCostBasis) // fall back to cost basis on error
        const qty = Number(h.quantity)
        // Shorts (negative qty) are liabilities — reduce total value
        return sum + qty * price
      }, 0)

      const totalValue = cashBalance + holdingsValue

      await db.portfolioSnapshot.create({
        data: {
          accountId: account.id,
          totalValue,
          cashBalance,
        },
      })

      saved++
    } catch {
      failed++
    }
  }

  return NextResponse.json({
    ok: true,
    accounts: accounts.length,
    saved,
    failed,
    timestamp: new Date().toISOString(),
  })
}
