export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getStockQuote } from '@/lib/market-data/finnhub'

// Broader stock list for the screener, grouped by sector
const SCREENER_STOCKS: { symbol: string; sector: string }[] = [
  // Technology
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
  // Finance
  { symbol: 'JPM', sector: 'Finance' },
  { symbol: 'BAC', sector: 'Finance' },
  { symbol: 'GS', sector: 'Finance' },
  { symbol: 'V', sector: 'Finance' },
  { symbol: 'MA', sector: 'Finance' },
  { symbol: 'BLK', sector: 'Finance' },
  // Healthcare
  { symbol: 'JNJ', sector: 'Healthcare' },
  { symbol: 'LLY', sector: 'Healthcare' },
  { symbol: 'UNH', sector: 'Healthcare' },
  { symbol: 'ABBV', sector: 'Healthcare' },
  { symbol: 'PFE', sector: 'Healthcare' },
  // Energy
  { symbol: 'XOM', sector: 'Energy' },
  { symbol: 'CVX', sector: 'Energy' },
  { symbol: 'COP', sector: 'Energy' },
  // Consumer
  { symbol: 'AMZN', sector: 'Consumer' },
  { symbol: 'WMT', sector: 'Consumer' },
  { symbol: 'COST', sector: 'Consumer' },
  { symbol: 'MCD', sector: 'Consumer' },
  { symbol: 'NKE', sector: 'Consumer' },
  // Industrials
  { symbol: 'BA', sector: 'Industrials' },
  { symbol: 'CAT', sector: 'Industrials' },
  { symbol: 'GE', sector: 'Industrials' },
]

export async function GET() {
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
