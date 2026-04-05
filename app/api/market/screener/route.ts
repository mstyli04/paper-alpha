export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getStockQuote } from '@/lib/market-data/finnhub'
import { makeLimiter, checkRateLimit } from '@/lib/rate-limit'

const SCREENER_STOCKS: { symbol: string; sector: string }[] = [
  { symbol: 'AAPL', sector: 'Technology' },
  { symbol: 'MSFT', sector: 'Technology' },
  { symbol: 'NVDA', sector: 'Technology' },
  { symbol: 'GOOGL', sector: 'Technology' },
  { symbol: 'META', sector: 'Technology' },
  { symbol: 'AMD', sector: 'Technology' },
  { symbol: 'TSLA', sector: 'Technology' },
  { symbol: 'ORCL', sector: 'Technology' },
  { symbol: 'CRM', sector: 'Technology' },
  { symbol: 'ADBE', sector: 'Technology' },
  { symbol: 'JPM', sector: 'Finance' },
  { symbol: 'BAC', sector: 'Finance' },
  { symbol: 'GS', sector: 'Finance' },
  { symbol: 'V', sector: 'Finance' },
  { symbol: 'MA', sector: 'Finance' },
  { symbol: 'BLK', sector: 'Finance' },
  { symbol: 'JNJ', sector: 'Healthcare' },
  { symbol: 'LLY', sector: 'Healthcare' },
  { symbol: 'UNH', sector: 'Healthcare' },
  { symbol: 'ABBV', sector: 'Healthcare' },
  { symbol: 'PFE', sector: 'Healthcare' },
  { symbol: 'XOM', sector: 'Energy' },
  { symbol: 'CVX', sector: 'Energy' },
  { symbol: 'COP', sector: 'Energy' },
  { symbol: 'AMZN', sector: 'Consumer' },
  { symbol: 'WMT', sector: 'Consumer' },
  { symbol: 'COST', sector: 'Consumer' },
  { symbol: 'MCD', sector: 'Consumer' },
  { symbol: 'NKE', sector: 'Consumer' },
  { symbol: 'BA', sector: 'Industrials' },
  { symbol: 'CAT', sector: 'Industrials' },
  { symbol: 'GE', sector: 'Industrials' },
]

const limiter = makeLimiter(20, '1 m')

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(limiter, userId)
  if (rl && !rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
    )
  }

  const results = await Promise.allSettled(
    SCREENER_STOCKS.map(async ({ symbol, sector }) => {
      const quote = await getStockQuote(symbol)
      return { ...quote, sector }
    })
  )

  const stocks = results
    .filter((r): r is PromiseFulfilledResult<ReturnType<typeof getStockQuote> extends Promise<infer T> ? T & { sector: string } : never> => r.status === 'fulfilled')
    .map(r => r.value)

  return NextResponse.json(stocks)
}
