export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()

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

const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'META', 'NVDA']

export async function GET(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const symbolsParam = searchParams.get('symbols')
  const symbols = symbolsParam
    ? symbolsParam.split(',').map(s => s.trim().toUpperCase()).slice(0, 10)
    : DEFAULT_SYMBOLS

  const toDate = new Date()
  const fromDate = new Date(Date.now() - 90 * 86400 * 1000)

  // Fetch all symbols in parallel — Yahoo Finance has no strict rate limit
  const results = await Promise.allSettled(
    symbols.map(symbol =>
      yahooFinance.chart(symbol, {
        period1: fromDate,
        period2: toDate,
        interval: '1d',
      }, { validateResult: false })
    )
  )

  const returnsMap: Record<string, number[]> = {}
  const validSymbols: string[] = []

  for (let i = 0; i < symbols.length; i++) {
    const result = results[i]
    if (result.status === 'fulfilled') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const quotes = (result.value as any)?.quotes ?? []
      const closes = quotes
        .map((q: { close: number | null }) => q.close)
        .filter((c: number | null): c is number => c !== null)
      if (closes.length > 10) {
        returnsMap[symbols[i]] = dailyReturns(closes)
        validSymbols.push(symbols[i])
      }
    }
  }

  if (validSymbols.length < 2) {
    return NextResponse.json({ symbols: [], matrix: {} })
  }

  const matrix: Record<string, Record<string, number>> = {}
  for (const a of validSymbols) {
    matrix[a] = {}
    for (const b of validSymbols) {
      matrix[a][b] = a === b ? 1 : pearson(returnsMap[a], returnsMap[b])
    }
  }

  return NextResponse.json({ symbols: validSymbols, matrix })
}
