import type { Quote, CandleData, SearchResult, TrendingAsset } from '@/types'
import type { CandleResolution } from './types'

const BASE_URL = 'https://finnhub.io/api/v1'

async function request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) throw new Error('FINNHUB_API_KEY is not set')

  const url = new URL(`${BASE_URL}${path}`)
  url.searchParams.set('token', apiKey)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString(), { next: { revalidate: 15 } })
  if (!res.ok) throw new Error(`Finnhub error: ${res.status}`)
  return res.json()
}

export async function getStockQuote(symbol: string): Promise<Quote> {
  const [quote, profile] = await Promise.all([
    request<{ c: number; d: number; dp: number; h: number; l: number; o: number; pc: number; v: number }>('/quote', { symbol }),
    request<{ name: string; logo: string; marketCapitalization: number }>('/stock/profile2', { symbol }).catch(() => ({ name: symbol, logo: '', marketCapitalization: 0 })),
  ])

  return {
    symbol,
    name: profile.name || symbol,
    price: quote.c,
    change: quote.d,
    changePercent: quote.dp,
    high: quote.h,
    low: quote.l,
    open: quote.o,
    previousClose: quote.pc,
    volume: quote.v,
    marketCap: profile.marketCapitalization ? profile.marketCapitalization * 1e6 : undefined,
    logoUrl: profile.logo || undefined,
    assetType: 'STOCK',
    timestamp: Date.now(),
  }
}

export async function getStockCandles(
  symbol: string,
  resolution: CandleResolution,
  from: number,
  to: number
): Promise<CandleData[]> {
  const data = await request<{
    c: number[]; h: number[]; l: number[]; o: number[]; t: number[]; v: number[]; s: string
  }>('/stock/candle', { symbol, resolution, from: String(from), to: String(to) })

  if (data.s !== 'ok' || !data.t) return []

  return data.t.map((time, i) => ({
    time,
    open: data.o[i],
    high: data.h[i],
    low: data.l[i],
    close: data.c[i],
    volume: data.v[i],
  }))
}

export async function searchStocks(query: string): Promise<SearchResult[]> {
  const data = await request<{ result: Array<{ symbol: string; description: string }> }>('/search', { q: query })

  return (data.result || [])
    .filter(r => r.symbol && !r.symbol.includes('.'))
    .slice(0, 10)
    .map(r => ({
      symbol: r.symbol,
      name: r.description,
      assetType: 'STOCK' as const,
    }))
}

export async function getTrendingStocks(): Promise<TrendingAsset[]> {
  // Finnhub doesn't have a trending endpoint on free tier; use a curated list
  const symbols = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL', 'AMD']
  const quotes = await Promise.allSettled(symbols.map(s => getStockQuote(s)))

  return quotes
    .filter((r): r is PromiseFulfilledResult<Quote> => r.status === 'fulfilled')
    .map(r => ({
      symbol: r.value.symbol,
      name: r.value.name,
      price: r.value.price,
      changePercent: r.value.changePercent,
      assetType: 'STOCK' as const,
      logoUrl: r.value.logoUrl,
    }))
}
