/**
 * LiveCoinWatch data provider for crypto quotes, candles, and trending.
 * Works by ticker code directly — no separate ID mapping needed, so any
 * coin (including small-caps like UWU) works as long as LCW tracks it.
 *
 * Requires LIVECOINWATCH_API_KEY in env.
 * Sign up free at https://www.livecoinwatch.com/tools/api
 */

import type { Quote, CandleData, TrendingAsset } from '@/types'

const BASE_URL = 'https://api.livecoinwatch.com'

function getHeaders(): Record<string, string> {
  const apiKey = process.env.LIVECOINWATCH_API_KEY
  if (!apiKey) throw new Error('LIVECOINWATCH_API_KEY is not set')
  return {
    'content-type': 'application/json',
    'x-api-key': apiKey,
  }
}

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (res.status === 429) throw new Error('LiveCoinWatch rate limit exceeded')
  if (!res.ok) throw new Error(`LiveCoinWatch error ${res.status} on ${path}`)
  return res.json()
}

// ── Symbol set (used for isCrypto routing) ────────────────────────────────────

let symbolSetCache: Set<string> | null = null
let symbolSetCachedAt = 0
const SYMBOL_SET_TTL = 60 * 60 * 1000 // 1 hour

export async function getCryptoSymbols(): Promise<Set<string>> {
  if (symbolSetCache && Date.now() - symbolSetCachedAt < SYMBOL_SET_TTL) {
    return symbolSetCache
  }

  try {
    // Fetch top 500 by rank in two pages
    const [page1, page2] = await Promise.allSettled([
      post<Array<{ code: string }>>('/coins/list', {
        currency: 'USD', sort: 'rank', order: 'ascending', offset: 0, limit: 250, meta: false,
      }),
      post<Array<{ code: string }>>('/coins/list', {
        currency: 'USD', sort: 'rank', order: 'ascending', offset: 250, limit: 250, meta: false,
      }),
    ])

    const set = new Set<string>()
    for (const result of [page1, page2]) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        for (const coin of result.value) {
          set.add(coin.code.toUpperCase())
        }
      }
    }

    if (set.size > 0) {
      symbolSetCache = set
      symbolSetCachedAt = Date.now()
      return set
    }
  } catch {
    // fall through to return empty set
  }

  // If LCW is unavailable return empty set — isCrypto() will fall back to
  // explicit assetType from the DB, which is always stored on trades.
  return new Set()
}

// ── Quote ─────────────────────────────────────────────────────────────────────

export async function getCryptoQuote(symbol: string): Promise<Quote> {
  const data = await post<{
    name: string
    rate: number
    volume: number
    cap: number
    delta: {
      hour: number
      day: number   // ratio: 1.02 = +2%, 0.98 = -2%
      week?: number
    }
    png64?: string
  }>('/coins/single', {
    currency: 'USD',
    code: symbol.toUpperCase(),
    meta: true,
  })

  const price = data.rate
  // delta.day is a multiplier; convert to percentage change
  const dayMultiplier = data.delta?.day ?? 1
  const changePercent = (dayMultiplier - 1) * 100
  const prevClose = dayMultiplier !== 0 ? price / dayMultiplier : price
  const change = price - prevClose

  return {
    symbol: symbol.toUpperCase(),
    name: data.name || symbol.toUpperCase(),
    price,
    change,
    changePercent,
    high: price,
    low: price,
    open: prevClose,
    previousClose: prevClose,
    volume: data.volume ?? 0,
    marketCap: data.cap ?? 0,
    assetType: 'CRYPTO',
    timestamp: Date.now(),
  }
}

// ── Candles / history ─────────────────────────────────────────────────────────

export async function getCryptoCandles(
  symbol: string,
  _resolution: string,
  from: number,
  to: number
): Promise<CandleData[]> {
  const data = await post<{
    history: Array<{ date: number; rate: number; volume?: number }>
  }>('/coins/history', {
    currency: 'USD',
    code: symbol.toUpperCase(),
    start: from * 1000,  // LCW uses milliseconds
    end: to * 1000,
    meta: false,
  })

  if (!Array.isArray(data.history)) return []

  return data.history.map(h => ({
    time: Math.floor(h.date / 1000),
    open: h.rate,
    high: h.rate,
    low: h.rate,
    close: h.rate,
    volume: h.volume,
  }))
}

// ── Trending ──────────────────────────────────────────────────────────────────

export async function getTrendingCrypto(): Promise<TrendingAsset[]> {
  const data = await post<Array<{
    code: string
    name: string
    rate: number
    delta: { day: number }
    png64?: string
  }>>('/coins/list', {
    currency: 'USD',
    sort: 'rank',
    order: 'ascending',
    offset: 0,
    limit: 10,
    meta: true,
  })

  if (!Array.isArray(data)) return []

  return data.map(c => ({
    symbol: c.code.toUpperCase(),
    name: c.name,
    price: c.rate,
    changePercent: ((c.delta?.day ?? 1) - 1) * 100,
    assetType: 'CRYPTO' as const,
    logoUrl: c.png64,
  }))
}
