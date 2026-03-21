export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getStockCandles } from '@/lib/market-data/finnhub'

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 5) return 0
  const ax = a.slice(0, n)
  const bx = b.slice(0, n)
  const meanA = ax.reduce((s, v) => s + v, 0) / n
  const meanB = bx.reduce((s, v) => s + v, 0) / n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) {
    num += (ax[i] - meanA) * (bx[i] - meanB)
    da += (ax[i] - meanA) ** 2
    db += (bx[i] - meanB) ** 2
  }
  const denom = Math.sqrt(da * db)
  return denom === 0 ? 0 : +(num / denom).toFixed(3)
}

function dailyReturns(closes: number[]): number[] {
  const returns: number[] = []
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1])
  }
  return returns
}

const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'AMD']

export async function GET(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const symbolsParam = searchParams.get('symbols')
  const symbols = symbolsParam ? symbolsParam.split(',').map(s => s.trim().toUpperCase()).slice(0, 10) : DEFAULT_SYMBOLS

  const to = Math.floor(Date.now() / 1000)
  const from = to - 90 * 86400 // 3 months

  // Fetch all candles in parallel
  const results = await Promise.allSettled(
    symbols.map(s => getStockCandles(s, 'D', from, to))
  )

  const returnsMap: Record<string, number[]> = {}
  const validSymbols: string[] = []

  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value.length > 10) {
      const closes = result.value.map(c => c.close)
      returnsMap[symbols[i]] = dailyReturns(closes)
      validSymbols.push(symbols[i])
    }
  })

  // Build correlation matrix
  const matrix: Record<string, Record<string, number>> = {}
  for (const a of validSymbols) {
    matrix[a] = {}
    for (const b of validSymbols) {
      matrix[a][b] = a === b ? 1 : pearson(returnsMap[a], returnsMap[b])
    }
  }

  return NextResponse.json({ symbols: validSymbols, matrix })
}
