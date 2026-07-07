export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCandles } from '@/lib/market-data'
import type { AssetType } from '@/types'

export interface HoldingHistorySymbol {
  assetType: AssetType
  candles: { time: number; close: number }[]
  trades: { time: number; side: string; quantity: number; price: number }[]
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: {
      account: {
        include: { trades: { orderBy: { createdAt: 'asc' } } },
      },
    },
  })

  if (!user?.account || user.account.trades.length === 0) return NextResponse.json({})

  // Group trades by symbol
  const symbolMap = new Map<string, { assetType: AssetType; trades: typeof user.account.trades }>()
  for (const trade of user.account.trades) {
    const existing = symbolMap.get(trade.symbol)
    if (!existing) {
      symbolMap.set(trade.symbol, { assetType: trade.assetType as AssetType, trades: [trade] })
    } else {
      existing.trades.push(trade)
    }
  }

  const now = Math.floor(Date.now() / 1000)
  const result: Record<string, HoldingHistorySymbol> = {}

  await Promise.allSettled(
    Array.from(symbolMap.entries()).map(async ([symbol, { assetType, trades }]) => {
      const firstTradeTime = Math.floor(new Date(trades[0].createdAt).getTime() / 1000)
      const from = firstTradeTime - 86400 * 2 // 2 days before first trade for context

      try {
        const candles = await getCandles(symbol, assetType, 'D', from, now)
        if (candles.length === 0) return
        result[symbol] = {
          assetType,
          candles: candles.map(c => ({ time: c.time, close: c.close })),
          trades: trades.map(t => ({
            time: Math.floor(new Date(t.createdAt).getTime() / 1000),
            side: t.side,
            quantity: Number(t.quantity),
            price: Number(t.price),
          })),
        }
      } catch {
        // Skip symbols where candle fetch fails
      }
    })
  )

  return NextResponse.json(result)
}
