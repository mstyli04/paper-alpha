// lib/market-data/binance.ts
// Binance public API — no API key required, 1200 req/min rate limit.
import type { Quote, CandleData } from '@/types'

const BASE_URL = 'https://api.binance.com/api/v3'

function toUSDT(symbol: string): string {
  return `${symbol.toUpperCase()}USDT`
}

async function request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { next: { revalidate: 30 } })
  if (!res.ok) throw new Error(`Binance error: ${res.status}`)
  return res.json()
}

export async function getBinanceCryptoQuote(symbol: string): Promise<Quote> {
  const ticker = await request<{
    symbol: string
    lastPrice: string
    priceChange: string
    priceChangePercent: string
    highPrice: string
    lowPrice: string
    openPrice: string
    volume: string
  }>('/ticker/24hr', { symbol: toUSDT(symbol) })

  return {
    symbol,
    name: symbol,
    price: parseFloat(ticker.lastPrice),
    change: parseFloat(ticker.priceChange),
    changePercent: parseFloat(ticker.priceChangePercent),
    high: parseFloat(ticker.highPrice),
    low: parseFloat(ticker.lowPrice),
    open: parseFloat(ticker.openPrice),
    volume: parseFloat(ticker.volume),
    assetType: 'CRYPTO',
    timestamp: Date.now(),
  }
}

export async function getBinanceCryptoCandles(
  symbol: string,
  from: number,
  to: number
): Promise<CandleData[]> {
  const limit = Math.min(Math.ceil((to - from) / 86400) + 2, 100)
  const klines = await request<Array<[
    number, string, string, string, string, string, number, string, number
  ]>>('/klines', {
    symbol: toUSDT(symbol),
    interval: '1d',
    startTime: String(from * 1000),
    endTime: String(to * 1000),
    limit: String(limit),
  })

  return klines.map(k => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }))
}
