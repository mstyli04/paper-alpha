export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getCandles } from '@/lib/market-data'
import type { AssetType } from '@/types'

function calcMetrics(closes: number[]) {
  if (closes.length < 10) return null

  // Daily returns
  const returns: number[] = []
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1])
  }

  const n = returns.length
  const mean = returns.reduce((s, r) => s + r, 0) / n
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / n
  const stdDev = Math.sqrt(variance)

  // Annualized volatility (252 trading days)
  const annualizedVol = stdDev * Math.sqrt(252) * 100

  // Sharpe ratio (risk-free rate ~5% annual = 0.05/252 daily)
  const riskFreeDaily = 0.05 / 252
  const sharpe = stdDev === 0 ? 0 : ((mean - riskFreeDaily) / stdDev) * Math.sqrt(252)

  // Max drawdown
  let peak = closes[0]
  let maxDrawdown = 0
  for (const price of closes) {
    if (price > peak) peak = price
    const drawdown = (peak - price) / peak
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }

  // Total return over period
  const totalReturn = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100

  // Best / worst single day
  const bestDay = Math.max(...returns) * 100
  const worstDay = Math.min(...returns) * 100

  return {
    annualizedVol: +annualizedVol.toFixed(2),
    sharpe: +sharpe.toFixed(2),
    maxDrawdown: +(maxDrawdown * 100).toFixed(2),
    totalReturn: +totalReturn.toFixed(2),
    bestDay: +bestDay.toFixed(2),
    worstDay: +worstDay.toFixed(2),
    dataPoints: closes.length,
  }
}

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')
  const assetType = (searchParams.get('assetType') || 'STOCK') as AssetType

  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })

  const to = Math.floor(Date.now() / 1000)
  const from = to - 365 * 86400 // 1 year of data

  try {
    const candles = await getCandles(symbol, assetType, 'D', from, to)
    const closes = candles.map(c => c.close).filter(Boolean)
    const metrics = calcMetrics(closes)
    return NextResponse.json(metrics ?? { error: 'Not enough data' })
  } catch {
    return NextResponse.json({ error: 'Failed to calculate metrics' }, { status: 500 })
  }
}
