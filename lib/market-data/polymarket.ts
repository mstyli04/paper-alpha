import type { Quote, CandleData, SearchResult, TrendingAsset } from '@/types'

const CLOB_BASE = 'https://clob.polymarket.com'
const GAMMA_BASE = 'https://gamma-api.polymarket.com'

// ── Internal API shapes ──────────────────────────────────────────────────────

interface CLOBMarket {
  condition_id: string
  question: string
  tokens: Array<{ token_id: string; outcome: string; price: number }>
  active: boolean
  closed: boolean
  end_date_iso: string
  volume: string
  volume_24hr: number
}

interface GammaMarket {
  conditionId: string
  question: string
  outcomePrices: string  // JSON string e.g. '["0.65","0.35"]'
  volume: string
  volume24hr: number
  tags: Array<{ id: number; label: string; slug: string }>
  active: boolean
  closed: boolean
}

interface PricePoint {
  t: number  // Unix timestamp seconds
  p: number  // Price 0–1
}

const CATEGORY_SLUGS = ['politics', 'crypto', 'sports', 'business', 'news-economy']

// ── Exported mapping helpers (also used by tests) ───────────────────────────

export function mapCLOBMarketToQuote(market: CLOBMarket, symbolWithSuffix: string): Quote {
  const parts = symbolWithSuffix.split(':')
  const side = parts[1] ?? 'YES'

  const yesToken = market.tokens.find(t => t.outcome === 'Yes') ?? market.tokens[0]
  const noToken = market.tokens.find(t => t.outcome === 'No') ?? market.tokens[1]
  const yesPrice = yesToken?.price ?? 0
  const noPrice = noToken?.price ?? 0
  const price = side === 'NO' ? noPrice : yesPrice

  const q = market.question
  const name = q.length > 60 ? q.slice(0, 57) + '...' : q

  return {
    symbol: symbolWithSuffix,
    name,
    price,
    change: 0,
    changePercent: 0,
    high: price,
    low: price,
    open: price,
    previousClose: price,
    volume: market.volume_24hr ?? 0,
    assetType: 'PREDICTION',
    timestamp: Date.now(),
    question: market.question,
    yesPrice,
    noPrice,
    conditionId: market.condition_id,
    resolved: market.closed,
    resolvesAt: market.end_date_iso
      ? new Date(market.end_date_iso).getTime() / 1000
      : undefined,
  }
}

export function mapGammaMarketToTrendingAsset(market: GammaMarket): TrendingAsset {
  let yesPrice = 0
  try {
    const prices = JSON.parse(market.outcomePrices) as [string, string]
    yesPrice = parseFloat(prices[0]) || 0
  } catch {
    // malformed field — default to 0
  }
  const tag = market.tags?.[0]?.label ?? 'Prediction'

  return {
    symbol: market.conditionId,
    name: market.question,
    description: tag,
    price: yesPrice,
    changePercent: 0,
    assetType: 'PREDICTION',
  }
}

export function mapPriceHistoryToCandles(
  history: PricePoint[],
  from: number,
  to: number
): CandleData[] {
  return history
    .filter(pt => pt.t >= from && pt.t <= to)
    .map(pt => ({
      time: pt.t,
      open: pt.p,
      high: pt.p,
      low: pt.p,
      close: pt.p,
      volume: 0,
    }))
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getPolymarketQuote(symbolWithSuffix: string): Promise<Quote> {
  const conditionId = symbolWithSuffix.split(':')[0]
  const res = await fetch(`${CLOB_BASE}/markets/${conditionId}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Polymarket CLOB error: ${res.status}`)
  const market: CLOBMarket = await res.json()
  return mapCLOBMarketToQuote(market, symbolWithSuffix)
}

export async function getPolymarketCandles(
  symbolWithSuffix: string,
  from: number,
  to: number
): Promise<CandleData[]> {
  const conditionId = symbolWithSuffix.split(':')[0]

  // Get YES token_id (candles always show YES token price)
  const marketRes = await fetch(`${CLOB_BASE}/markets/${conditionId}`, { cache: 'no-store' })
  if (!marketRes.ok) return []
  const market: CLOBMarket = await marketRes.json()
  const yesToken = market.tokens.find(t => t.outcome === 'Yes') ?? market.tokens[0]
  if (!yesToken) return []

  const histRes = await fetch(
    `${CLOB_BASE}/prices-history?market=${yesToken.token_id}&startTs=${from}&endTs=${to}&fidelity=1440`,
    { cache: 'no-store' }
  )
  if (!histRes.ok) return []

  const { history } = await histRes.json() as { history: PricePoint[] }
  return mapPriceHistoryToCandles(history ?? [], from, to)
}

export async function getTrendingPredictions(): Promise<TrendingAsset[]> {
  const results = await Promise.allSettled(
    CATEGORY_SLUGS.map(slug =>
      fetch(
        `${GAMMA_BASE}/markets?tag_slug=${slug}&active=true&closed=false&limit=20`,
        { next: { revalidate: 120 } }
      )
        .then(r => (r.ok ? r.json() : []) as Promise<GammaMarket[]>)
        .catch(() => [] as GammaMarket[])
    )
  )

  const seen = new Set<string>()
  const markets: GammaMarket[] = []
  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    for (const m of result.value) {
      if (!seen.has(m.conditionId)) {
        seen.add(m.conditionId)
        markets.push(m)
      }
    }
  }

  return markets
    .sort((a, b) => parseFloat(b.volume ?? '0') - parseFloat(a.volume ?? '0'))
    .slice(0, 50)
    .map(mapGammaMarketToTrendingAsset)
}

export async function searchPredictions(query: string): Promise<SearchResult[]> {
  const res = await fetch(
    `${GAMMA_BASE}/markets?q=${encodeURIComponent(query)}&active=true&closed=false&limit=10`,
    { cache: 'no-store' }
  )
  if (!res.ok) return []
  const markets = await res.json() as GammaMarket[]
  return markets.map(m => ({
    symbol: m.conditionId,
    name: m.question,
    assetType: 'PREDICTION' as const,
  }))
}
