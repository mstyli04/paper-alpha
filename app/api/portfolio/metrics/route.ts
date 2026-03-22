export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export interface RiskMetrics {
  totalReturn: number        // %
  sharpeRatio: number | null
  maxDrawdown: number        // % (negative)
  volatility: number         // annualized %
  bestDay: number            // %
  worstDay: number           // %
  winRate: number | null     // % of closed symbols that are profitable
  totalTrades: number
  snapshotCount: number
}

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { account: true },
  })
  if (!user?.account) return NextResponse.json({ error: 'No account' }, { status: 404 })

  const [snapshots, holdings, tradeCount] = await Promise.all([
    db.portfolioSnapshot.findMany({
      where: { accountId: user.account.id },
      orderBy: { createdAt: 'asc' },
    }),
    db.holding.findMany({
      where: { accountId: user.account.id },
    }),
    db.trade.count({ where: { accountId: user.account.id } }),
  ])

  const startingBalance = Number(user.account.startingBalance)

  // Need at least 2 snapshots for meaningful metrics
  if (snapshots.length < 2) {
    return NextResponse.json({
      totalReturn: 0,
      sharpeRatio: null,
      maxDrawdown: 0,
      volatility: 0,
      bestDay: 0,
      worstDay: 0,
      winRate: null,
      totalTrades: tradeCount,
      snapshotCount: snapshots.length,
    } satisfies RiskMetrics)
  }

  const values = snapshots.map(s => Number(s.totalValue))

  // Daily returns
  const dailyReturns: number[] = []
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) {
      dailyReturns.push((values[i] - values[i - 1]) / values[i - 1])
    }
  }

  // Total return
  const totalReturn = ((values[values.length - 1] - startingBalance) / startingBalance) * 100

  // Sharpe ratio (annualised, risk-free rate 5% / 252)
  let sharpeRatio: number | null = null
  if (dailyReturns.length >= 5) {
    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
    const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dailyReturns.length
    const stdDev = Math.sqrt(variance)
    const riskFreeDaily = 0.05 / 252
    if (stdDev > 0) {
      sharpeRatio = Math.round(((mean - riskFreeDaily) / stdDev) * Math.sqrt(252) * 100) / 100
    }
  }

  // Max drawdown
  let peak = values[0]
  let maxDrawdown = 0
  for (const v of values) {
    if (v > peak) peak = v
    const drawdown = (v - peak) / peak
    if (drawdown < maxDrawdown) maxDrawdown = drawdown
  }

  // Volatility (annualised std dev of daily returns)
  let volatility = 0
  if (dailyReturns.length >= 2) {
    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
    const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dailyReturns.length
    volatility = Math.sqrt(variance) * Math.sqrt(252) * 100
  }

  // Best / worst day
  const bestDay = dailyReturns.length > 0 ? Math.max(...dailyReturns) * 100 : 0
  const worstDay = dailyReturns.length > 0 ? Math.min(...dailyReturns) * 100 : 0

  // Win rate: % of closed symbols (realizedPnl != 0) with realizedPnl > 0
  let winRate: number | null = null
  const closedPositions = holdings.filter(h => Number(h.realizedPnl) !== 0)
  if (closedPositions.length > 0) {
    const winners = closedPositions.filter(h => Number(h.realizedPnl) > 0).length
    winRate = Math.round((winners / closedPositions.length) * 100)
  }

  return NextResponse.json({
    totalReturn: Math.round(totalReturn * 100) / 100,
    sharpeRatio,
    maxDrawdown: Math.round(maxDrawdown * 10000) / 100,
    volatility: Math.round(volatility * 100) / 100,
    bestDay: Math.round(bestDay * 100) / 100,
    worstDay: Math.round(worstDay * 100) / 100,
    winRate,
    totalTrades: tradeCount,
    snapshotCount: snapshots.length,
  } satisfies RiskMetrics)
}
