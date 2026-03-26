export const dynamic = 'force-dynamic'

import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getQuote } from '@/lib/market-data'
import { executeTrade } from '@/lib/trading-engine'

export async function POST(req: Request) {
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

  const activeOrders = await db.stopOrder.findMany({
    where: { status: 'ACTIVE' },
  })

  if (activeOrders.length === 0) return NextResponse.json({ triggered: 0 })

  // Deduplicate symbols to minimise API calls
  const uniqueSymbols = Array.from(
    new Map(activeOrders.map(o => [`${o.symbol}:${o.assetType}`, o])).keys()
  )

  const priceMap: Record<string, number> = {}
  await Promise.allSettled(
    uniqueSymbols.map(async key => {
      const [symbol, assetType] = key.split(':')
      try {
        const quote = await getQuote(symbol, assetType as 'STOCK' | 'CRYPTO' | 'COMMODITY')
        priceMap[key] = quote.price
      } catch {}
    })
  )

  let triggered = 0
  for (const order of activeOrders) {
    const key = `${order.symbol}:${order.assetType}`
    const price = priceMap[key]
    if (price === undefined) continue

    const triggerPrice = Number(order.triggerPrice)
    const shouldTrigger =
      order.condition === 'ABOVE' ? price >= triggerPrice : price <= triggerPrice

    if (!shouldTrigger) continue

    // Execute the trade
    const result = await executeTrade({
      accountId: order.accountId,
      symbol: order.symbol,
      assetType: order.assetType as 'STOCK' | 'CRYPTO' | 'COMMODITY',
      side: order.side as 'BUY' | 'SELL' | 'SHORT' | 'COVER',
      quantity: Number(order.quantity),
    })

    await db.stopOrder.update({
      where: { id: order.id },
      data: {
        status: result.success ? 'TRIGGERED' : 'FAILED',
        triggeredAt: new Date(),
      },
    })

    if (result.success) triggered++
  }

  return NextResponse.json({ triggered })
}
