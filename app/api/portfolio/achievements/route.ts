export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ACHIEVEMENTS } from '@/lib/achievements'
import type { EarnedAchievement } from '@/lib/achievements'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { account: { include: { holdings: true, trades: true } } },
  })
  if (!user?.account) return NextResponse.json({ error: 'No account' }, { status: 404 })

  const account = user.account
  const trades = account.trades
  const holdings = account.holdings

  const tradeCount = trades.length
  const shortTrades = trades.filter(t => t.side === 'SELL' || t.side === 'SHORT')
  const hasShort = trades.some(t => t.side === 'SHORT')

  // Profitable short: a holding that was shorted (qty < 0) with realizedPnl > 0
  const profitableShort = holdings.some(h => Number(h.realizedPnl) > 0 && trades.some(
    t => t.symbol === h.symbol && t.side === 'SHORT'
  ))

  const cashBalance = Number(account.cashBalance)
  const startingBalance = Number(account.startingBalance)

  // Estimate total value from holdings at cost basis (quick approximation)
  const holdingsValue = holdings.reduce((sum, h) => {
    const qty = Number(h.quantity)
    return sum + qty * Number(h.avgCostBasis)
  }, 0)
  const totalValue = cashBalance + holdingsValue
  const returnPct = ((totalValue - startingBalance) / startingBalance) * 100

  const longHoldings = holdings.filter(h => Number(h.quantity) > 0)

  const checks: Record<string, boolean> = {
    first_trade:      tradeCount >= 1,
    ten_trades:       tradeCount >= 10,
    fifty_trades:     tradeCount >= 50,
    hundred_trades:   tradeCount >= 100,
    in_profit:        returnPct > 0,
    five_percent:     returnPct >= 5,
    ten_percent:      returnPct >= 10,
    fifty_percent:    returnPct >= 50,
    doubled:          totalValue >= startingBalance * 2,
    diversified:      longHoldings.length >= 5,
    short_seller:     hasShort,
    profitable_short: profitableShort,
    whale:            totalValue >= 150000,
    beat_market:      returnPct >= 5, // simplified — just requires 5%+
  }

  const result: EarnedAchievement[] = ACHIEVEMENTS.map(a => ({
    ...a,
    earned: checks[a.id] ?? false,
  }))

  return NextResponse.json(result)
}
