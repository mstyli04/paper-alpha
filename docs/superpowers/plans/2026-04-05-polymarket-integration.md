# Polymarket Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Polymarket prediction markets as a new PREDICTION asset class — browse by category, paper-trade YES/NO tokens, auto-settle resolved markets via cron.

**Architecture:** Polymarket is a new market-data provider (`lib/market-data/polymarket.ts`) that maps to the existing `Quote`/`TrendingAsset` types. A `PREDICTION` value is added to `AssetType`. Symbols for YES/NO tokens use the format `{conditionId}:YES` / `{conditionId}:NO`. The existing trading engine and portfolio logic require no changes — only routing in the market-data layer, display adjustments in the UI, and a new settlement cron.

**Tech Stack:** Next.js 15, TypeScript, Prisma/PostgreSQL, Polymarket CLOB API (`https://clob.polymarket.com`), Polymarket Gamma API (`https://gamma-api.polymarket.com`), Vitest.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `types/index.ts` | Add `PREDICTION` to `AssetType`; extend `Quote` with prediction fields; add `name?` to `Holding` |
| Modify | `prisma/schema.prisma` | Add `PREDICTION` to `AssetType` enum |
| Create | `lib/market-data/polymarket.ts` | Polymarket data source — quote, candles, trending, search |
| Create | `__tests__/market-data/polymarket.test.ts` | Unit tests for polymarket data mapping |
| Modify | `lib/market-data/index.ts` | Route `PREDICTION` asset type; add `predictions` to `getTrending`; add to `search` |
| Modify | `lib/portfolio.ts` | Populate `name` field on prediction holdings from quote |
| Modify | `app/api/market/trending/route.ts` | Add `predictions: []` to fallback response |
| Modify | `app/(dashboard)/markets/page.tsx` | Add Predictions tab + category sub-filter |
| Create | `components/trading/prediction-order-form.tsx` | YES/NO token order form |
| Modify | `app/(dashboard)/markets/[symbol]/page.tsx` | Handle `PREDICTION` assetType — question display, YES/NO prices, prediction form |
| Modify | `components/portfolio/holdings-table.tsx` | Fix link/display for prediction holdings |
| Create | `app/api/cron/resolve-predictions/route.ts` | Settlement cron — auto-settle resolved prediction markets |
| Modify | `vercel.json` | Add hourly cron schedule for resolve-predictions |

---

## Task 1: Types & Schema

**Files:**
- Modify: `types/index.ts`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add PREDICTION to AssetType in types/index.ts and extend Quote and Holding**

Open `types/index.ts`. Replace the `AssetType` line and add prediction fields to `Quote` and `name?` to `Holding`:

```typescript
export type AssetType = 'STOCK' | 'CRYPTO' | 'COMMODITY' | 'PREDICTION'
export type TradeSide = 'BUY' | 'SELL' | 'SHORT' | 'COVER'

export interface Quote {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  high: number
  low: number
  open: number
  previousClose: number
  volume: number
  marketCap?: number
  assetType: AssetType
  logoUrl?: string
  timestamp: number
  // Prediction market fields (only present when assetType === 'PREDICTION')
  question?: string
  yesPrice?: number
  noPrice?: number
  resolvesAt?: number
  resolved?: boolean
  resolvedOutcome?: 'YES' | 'NO'
  conditionId?: string
}

export interface CandleData {
  time: number // Unix timestamp
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface SearchResult {
  symbol: string
  name: string
  assetType: AssetType
  logoUrl?: string
}

export interface Holding {
  id: string
  symbol: string
  assetType: AssetType
  quantity: number
  avgCostBasis: number
  realizedPnl: number
  name?: string          // populated from quote.name; useful for prediction market question text
  currentPrice?: number
  currentValue?: number
  unrealizedPnl?: number
  unrealizedPnlPercent?: number
}
```

Leave the remaining types (`Portfolio`, `TradeRecord`, `LeaderboardEntry`, `PortfolioSnapshot`, `TrendingAsset`) exactly as they are.

- [ ] **Step 2: Add PREDICTION to Prisma schema**

Open `prisma/schema.prisma`. Find the `AssetType` enum block and add `PREDICTION`:

```prisma
enum AssetType {
  STOCK
  CRYPTO
  COMMODITY
  PREDICTION
}
```

- [ ] **Step 3: Create and apply the migration**

```bash
cd /home/michael/paper-alpha && npm run db:migrate
```

When prompted for a migration name, enter: `add_prediction_asset_type`

Expected: Prisma creates a new migration file and applies it. Output ends with `All migrations have been applied.` or similar.

- [ ] **Step 4: Commit**

```bash
cd /home/michael/paper-alpha && git add types/index.ts prisma/schema.prisma prisma/migrations && git commit -m "feat: add PREDICTION to AssetType enum and extend Quote/Holding types"
```

---

## Task 2: Polymarket Data Source

**Files:**
- Create: `lib/market-data/polymarket.ts`
- Create: `__tests__/market-data/polymarket.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `__tests__/market-data/polymarket.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mapCLOBMarketToQuote, mapGammaMarketToTrendingAsset, mapPriceHistoryToCandles } from '@/lib/market-data/polymarket'

// --- mapCLOBMarketToQuote ---

const CLOB_MARKET = {
  condition_id: '0xabc123',
  question: 'Will Bitcoin reach $100k by end of 2025?',
  tokens: [
    { token_id: 'tok_yes', outcome: 'Yes', price: 0.65 },
    { token_id: 'tok_no', outcome: 'No', price: 0.35 },
  ],
  active: true,
  closed: false,
  end_date_iso: '2025-12-31T00:00:00Z',
  volume: '50000',
  volume_24hr: 1200,
}

describe('mapCLOBMarketToQuote', () => {
  it('maps YES token symbol to yesPrice', () => {
    const quote = mapCLOBMarketToQuote(CLOB_MARKET, '0xabc123:YES')
    expect(quote.price).toBe(0.65)
    expect(quote.yesPrice).toBe(0.65)
    expect(quote.noPrice).toBe(0.35)
    expect(quote.assetType).toBe('PREDICTION')
    expect(quote.conditionId).toBe('0xabc123')
  })

  it('maps NO token symbol to noPrice as the main price', () => {
    const quote = mapCLOBMarketToQuote(CLOB_MARKET, '0xabc123:NO')
    expect(quote.price).toBe(0.35)
  })

  it('defaults to YES price when no suffix', () => {
    const quote = mapCLOBMarketToQuote(CLOB_MARKET, '0xabc123')
    expect(quote.price).toBe(0.65)
  })

  it('sets question from market question', () => {
    const quote = mapCLOBMarketToQuote(CLOB_MARKET, '0xabc123')
    expect(quote.question).toBe('Will Bitcoin reach $100k by end of 2025?')
  })

  it('marks resolved when market is closed', () => {
    const closed = { ...CLOB_MARKET, closed: true, active: false }
    const quote = mapCLOBMarketToQuote(closed, '0xabc123')
    expect(quote.resolved).toBe(true)
  })

  it('sets resolvesAt from end_date_iso', () => {
    const quote = mapCLOBMarketToQuote(CLOB_MARKET, '0xabc123')
    expect(quote.resolvesAt).toBe(new Date('2025-12-31T00:00:00Z').getTime() / 1000)
  })

  it('truncates long question in name field', () => {
    const longQ = { ...CLOB_MARKET, question: 'A'.repeat(80) }
    const quote = mapCLOBMarketToQuote(longQ, '0xabc123')
    expect(quote.name.length).toBeLessThanOrEqual(63) // 60 chars + '...'
  })
})

// --- mapGammaMarketToTrendingAsset ---

const GAMMA_MARKET = {
  conditionId: '0xdef456',
  question: 'Will the Fed cut rates in Q1 2026?',
  outcomePrices: '["0.72","0.28"]',
  volume: '80000',
  volume24hr: 3000,
  tags: [{ id: 1, label: 'Politics', slug: 'politics' }],
  active: true,
  closed: false,
}

describe('mapGammaMarketToTrendingAsset', () => {
  it('maps conditionId to symbol', () => {
    const asset = mapGammaMarketToTrendingAsset(GAMMA_MARKET)
    expect(asset.symbol).toBe('0xdef456')
  })

  it('parses YES price from outcomePrices JSON', () => {
    const asset = mapGammaMarketToTrendingAsset(GAMMA_MARKET)
    expect(asset.price).toBe(0.72)
  })

  it('sets description from first tag label', () => {
    const asset = mapGammaMarketToTrendingAsset(GAMMA_MARKET)
    expect(asset.description).toBe('Politics')
  })

  it('falls back to Prediction when no tags', () => {
    const noTags = { ...GAMMA_MARKET, tags: [] }
    const asset = mapGammaMarketToTrendingAsset(noTags)
    expect(asset.description).toBe('Prediction')
  })

  it('sets assetType to PREDICTION', () => {
    const asset = mapGammaMarketToTrendingAsset(GAMMA_MARKET)
    expect(asset.assetType).toBe('PREDICTION')
  })
})

// --- mapPriceHistoryToCandles ---

describe('mapPriceHistoryToCandles', () => {
  const history = [
    { t: 1000, p: 0.60 },
    { t: 2000, p: 0.65 },
    { t: 3000, p: 0.70 },
    { t: 4000, p: 0.68 },
  ]

  it('maps each price point to a candle with O=H=L=C=p', () => {
    const candles = mapPriceHistoryToCandles(history, 0, 9999)
    expect(candles[0]).toEqual({ time: 1000, open: 0.60, high: 0.60, low: 0.60, close: 0.60, volume: 0 })
    expect(candles[1].close).toBe(0.65)
  })

  it('filters points outside from/to range', () => {
    const candles = mapPriceHistoryToCandles(history, 1500, 3500)
    expect(candles).toHaveLength(2)
    expect(candles[0].time).toBe(2000)
    expect(candles[1].time).toBe(3000)
  })

  it('returns empty array for empty history', () => {
    expect(mapPriceHistoryToCandles([], 0, 9999)).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/michael/paper-alpha && npm run test -- __tests__/market-data/polymarket.test.ts
```

Expected: FAIL — `mapCLOBMarketToQuote`, `mapGammaMarketToTrendingAsset`, `mapPriceHistoryToCandles` are not defined.

- [ ] **Step 3: Implement lib/market-data/polymarket.ts**

Create `lib/market-data/polymarket.ts`:

```typescript
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
  const prices = JSON.parse(market.outcomePrices) as [string, string]
  const yesPrice = parseFloat(prices[0])
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/michael/paper-alpha && npm run test -- __tests__/market-data/polymarket.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/michael/paper-alpha && git add lib/market-data/polymarket.ts __tests__/market-data/polymarket.test.ts && git commit -m "feat: add Polymarket data source with quote/candle/trending/search"
```

---

## Task 3: Wire Polymarket into Market-Data Index

**Files:**
- Modify: `lib/market-data/index.ts`

- [ ] **Step 1: Update index.ts to route PREDICTION and add predictions to getTrending/search**

Replace the entire contents of `lib/market-data/index.ts` with:

```typescript
import type { Quote, CandleData, SearchResult, TrendingAsset } from '@/types'
import type { CandleResolution } from './types'
import { getStockQuote, getStockCandles, searchStocks, getTrendingStocks } from './finnhub'
import { searchCrypto, getTrendingCrypto, getCryptoSymbols } from './coingecko'
import { getBinanceCryptoQuote, getBinanceCryptoCandles } from './binance'
import {
  getCommodityQuote,
  getCommodityCandles,
  getCommodityIntradayCandles,
  getTrendingCommodities,
  isCommoditySymbol,
  getStockCandlesYahoo,
} from './yahoo'
import {
  getPolymarketQuote,
  getPolymarketCandles,
  getTrendingPredictions,
  searchPredictions,
} from './polymarket'

export async function isCrypto(symbol: string): Promise<boolean> {
  const symbols = await getCryptoSymbols()
  return symbols.has(symbol.toUpperCase())
}

export async function getQuote(symbol: string, assetType?: 'STOCK' | 'CRYPTO' | 'COMMODITY' | 'PREDICTION'): Promise<Quote> {
  if (assetType === 'PREDICTION') return getPolymarketQuote(symbol)
  if (assetType === 'COMMODITY' || isCommoditySymbol(symbol)) return getCommodityQuote(symbol)
  const type = assetType ?? ((await isCrypto(symbol)) ? 'CRYPTO' : 'STOCK')
  if (type === 'CRYPTO') return getBinanceCryptoQuote(symbol)
  return getStockQuote(symbol)
}

export async function getCandles(
  symbol: string,
  assetType: 'STOCK' | 'CRYPTO' | 'COMMODITY' | 'PREDICTION',
  resolution: CandleResolution,
  from: number,
  to: number
): Promise<CandleData[]> {
  if (assetType === 'PREDICTION') return getPolymarketCandles(symbol, from, to)
  if (assetType === 'COMMODITY') {
    if (resolution === '1') return getCommodityIntradayCandles(symbol)
    return getCommodityCandles(symbol, from, to)
  }
  if (assetType === 'CRYPTO') return getBinanceCryptoCandles(symbol, from, to)
  let candles: CandleData[] = []
  try {
    candles = await getStockCandles(symbol, resolution, from, to)
  } catch { /* Finnhub unavailable on free tier — fall through to Yahoo */ }
  if (candles.length > 0) return candles
  return getStockCandlesYahoo(symbol, from, to, resolution)
}

export async function search(query: string): Promise<SearchResult[]> {
  const [stocks, crypto, predictions] = await Promise.allSettled([
    searchStocks(query),
    searchCrypto(query),
    searchPredictions(query),
  ])
  const results: SearchResult[] = []
  if (stocks.status === 'fulfilled') results.push(...stocks.value)
  if (crypto.status === 'fulfilled') results.push(...crypto.value)
  if (predictions.status === 'fulfilled') results.push(...predictions.value)
  return results.slice(0, 20)
}

export async function getTrending(): Promise<{
  stocks: TrendingAsset[]
  crypto: TrendingAsset[]
  commodities: TrendingAsset[]
  predictions: TrendingAsset[]
}> {
  const [stocks, crypto, commodities, predictions] = await Promise.allSettled([
    getTrendingStocks(),
    getTrendingCrypto(),
    getTrendingCommodities(),
    getTrendingPredictions(),
  ])
  return {
    stocks: stocks.status === 'fulfilled' ? stocks.value : [],
    crypto: crypto.status === 'fulfilled' ? crypto.value : [],
    commodities: commodities.status === 'fulfilled' ? commodities.value : [],
    predictions: predictions.status === 'fulfilled' ? predictions.value : [],
  }
}
```

- [ ] **Step 2: Update the trending API route fallback to include predictions**

Open `app/api/market/trending/route.ts`. Change the catch block fallback from:

```typescript
return NextResponse.json({ stocks: [], crypto: [], commodities: [] }, ...)
```

to:

```typescript
return NextResponse.json({ stocks: [], crypto: [], commodities: [], predictions: [] }, ...)
```

The full file after the change:

```typescript
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getTrending } from '@/lib/market-data'

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await getTrending()
    return NextResponse.json(data, { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' } })
  } catch {
    return NextResponse.json(
      { stocks: [], crypto: [], commodities: [], predictions: [] },
      { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' } }
    )
  }
}
```

- [ ] **Step 3: Commit**

```bash
cd /home/michael/paper-alpha && git add lib/market-data/index.ts "app/api/market/trending/route.ts" && git commit -m "feat: wire Polymarket into market-data router and trending API"
```

---

## Task 4: Populate Holding Name from Quote

**Files:**
- Modify: `lib/portfolio.ts`

- [ ] **Step 1: Add name field to holdings in getPortfolio**

Open `lib/portfolio.ts`. In the `holdings.map()` call (around line 20), find the return object and add `name: priceResult.status === 'fulfilled' ? priceResult.value.name : undefined`:

Find this block:

```typescript
    return {
      id: h.id,
      symbol: h.symbol,
      assetType: h.assetType as AssetType,
      quantity,
      avgCostBasis,
      realizedPnl: Number(h.realizedPnl),
      currentPrice,
      currentValue,
      unrealizedPnl,
      unrealizedPnlPercent,
    }
```

Replace with:

```typescript
    return {
      id: h.id,
      symbol: h.symbol,
      assetType: h.assetType as AssetType,
      quantity,
      avgCostBasis,
      realizedPnl: Number(h.realizedPnl),
      name: priceResult.status === 'fulfilled' ? priceResult.value.name : undefined,
      currentPrice,
      currentValue,
      unrealizedPnl,
      unrealizedPnlPercent,
    }
```

- [ ] **Step 2: Commit**

```bash
cd /home/michael/paper-alpha && git add lib/portfolio.ts && git commit -m "feat: populate holding name from quote (surfaces question text for predictions)"
```

---

## Task 5: Markets Page — Predictions Tab

**Files:**
- Modify: `app/(dashboard)/markets/page.tsx`

- [ ] **Step 1: Update the markets page with Predictions tab and category filter**

Replace the full contents of `app/(dashboard)/markets/page.tsx` with:

```typescript
'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { TrendingUp, Star } from 'lucide-react'
import { AssetRow } from '@/components/markets/asset-row'
import { Skeleton } from '@/components/ui/skeleton'
import { useWatchlist } from '@/hooks/use-watchlist'
import type { TrendingAsset } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type Tab = 'stocks' | 'crypto' | 'commodities' | 'predictions' | 'gainers' | 'watchlist'

const TAB_LABELS: Record<Tab, string> = {
  stocks: 'Stocks',
  crypto: 'Crypto',
  commodities: 'Commodities',
  predictions: 'Predictions',
  gainers: '🔥 Gainers',
  watchlist: '⭐ Watchlist',
}

const PREDICTION_CATEGORIES = ['All', 'Politics', 'Crypto', 'Sports', 'Business', 'News & Economy'] as const
type PredictionCategory = typeof PREDICTION_CATEGORIES[number]

const CATEGORY_SLUG_MAP: Record<PredictionCategory, string | null> = {
  'All': null,
  'Politics': 'politics',
  'Crypto': 'crypto',
  'Sports': 'sports',
  'Business': 'business',
  'News & Economy': 'news-economy',
}

export default function MarketsPage() {
  const [tab, setTab] = useState<Tab>('stocks')
  const [predCategory, setPredCategory] = useState<PredictionCategory>('All')
  const { data, isLoading } = useSWR<{
    stocks: TrendingAsset[]
    crypto: TrendingAsset[]
    commodities: TrendingAsset[]
    predictions: TrendingAsset[]
  }>(
    '/api/market/trending',
    fetcher,
    { refreshInterval: 30000 }
  )
  const { watchlist, watchedSymbols, toggle } = useWatchlist()

  const allAssets = [
    ...(data?.stocks ?? []),
    ...(data?.crypto ?? []),
    ...(data?.commodities ?? []),
  ]
  const gainers = [...allAssets]
    .filter(a => a.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent)

  const watchlistAssets: TrendingAsset[] = watchlist.map(w => {
    const found = allAssets.find(a => a.symbol === w.symbol)
    return found ?? { symbol: w.symbol, name: w.symbol, price: 0, changePercent: 0, assetType: w.assetType }
  })

  const slug = CATEGORY_SLUG_MAP[predCategory]
  const allPredictions = data?.predictions ?? []
  const filteredPredictions = slug
    ? allPredictions.filter(a => a.description?.toLowerCase() === predCategory.toLowerCase())
    : allPredictions

  const assets =
    tab === 'stocks' ? (data?.stocks ?? []) :
    tab === 'crypto' ? (data?.crypto ?? []) :
    tab === 'commodities' ? (data?.commodities ?? []) :
    tab === 'predictions' ? filteredPredictions :
    tab === 'gainers' ? gainers :
    watchlistAssets

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Markets</h1>
        <p className="text-text-muted text-sm mt-1">Live prices for stocks, crypto, commodities and prediction markets</p>
      </div>

      <div className="card overflow-hidden">
        <div className="flex border-b border-border overflow-x-auto">
          {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                tab === t
                  ? 'text-brand border-brand'
                  : 'text-text-muted border-transparent hover:text-text-primary'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Category filter for predictions tab */}
        {tab === 'predictions' && (
          <div className="flex gap-2 px-4 py-2.5 border-b border-border overflow-x-auto">
            {PREDICTION_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setPredCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  predCategory === cat
                    ? 'bg-brand/10 text-brand border border-brand/30'
                    : 'text-text-muted border border-border hover:text-text-primary'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-2 border-b border-border">
          <span className="w-6" />
          <div className="flex items-center gap-3">
            <div className="w-9" />
            <span className="text-xs text-text-muted font-medium">Asset</span>
          </div>
          <span className="text-xs text-text-muted font-medium text-right w-32">
            {tab === 'predictions' ? 'YES Price / Chg' : 'Price / Change'}
          </span>
          <span className="w-8" />
        </div>

        {isLoading && tab !== 'watchlist' ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="py-16 text-center text-text-muted text-sm">
            {tab === 'gainers' ? (
              <><TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-40" />No gainers found right now.</>
            ) : tab === 'watchlist' ? (
              <><Star className="w-8 h-8 mx-auto mb-3 opacity-40" />No symbols in your watchlist yet.<br />Star any asset to add it here.</>
            ) : (
              <><TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-40" />Failed to load market data.</>
            )}
          </div>
        ) : (
          assets.map((asset, i) => (
            <AssetRow
              key={asset.symbol}
              asset={asset}
              rank={tab !== 'watchlist' ? i + 1 : undefined}
              watched={watchedSymbols.has(asset.symbol)}
              onToggleWatch={() => toggle(asset.symbol, asset.assetType)}
            />
          ))
        )}
      </div>

      <p className="text-xs text-text-muted text-center">
        Prices refresh every 30 seconds. Stocks: Finnhub · Crypto: CoinGecko · Commodities: Yahoo Finance · Predictions: Polymarket.
        Paper trading only — not financial advice.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/michael/paper-alpha && git add "app/(dashboard)/markets/page.tsx" && git commit -m "feat: add Predictions tab with category filter to markets page"
```

---

## Task 6: PredictionOrderForm Component

**Files:**
- Create: `components/trading/prediction-order-form.tsx`

- [ ] **Step 1: Create the PredictionOrderForm component**

Create `components/trading/prediction-order-form.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { OrderForm } from './order-form'

interface PredictionOrderFormProps {
  conditionId: string
  yesPrice: number
  noPrice: number
  question: string
  onSuccess?: () => void
}

type OutcomeTab = 'YES' | 'NO'

export function PredictionOrderForm({
  conditionId,
  yesPrice,
  noPrice,
  question,
  onSuccess,
}: PredictionOrderFormProps) {
  const [outcome, setOutcome] = useState<OutcomeTab>('YES')

  return (
    <div className="space-y-3">
      {/* YES / NO selector */}
      <div className="card p-4">
        <p className="text-xs text-text-muted mb-3 leading-relaxed">{question}</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setOutcome('YES')}
            className={`py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
              outcome === 'YES'
                ? 'bg-green/10 text-green border-green/40'
                : 'text-text-muted border-border hover:text-green hover:border-green/40'
            }`}
          >
            YES <span className="font-mono ml-1">{(yesPrice * 100).toFixed(0)}¢</span>
          </button>
          <button
            onClick={() => setOutcome('NO')}
            className={`py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
              outcome === 'NO'
                ? 'bg-red/10 text-red border-red/40'
                : 'text-text-muted border-border hover:text-red hover:border-red/40'
            }`}
          >
            NO <span className="font-mono ml-1">{(noPrice * 100).toFixed(0)}¢</span>
          </button>
        </div>
      </div>

      {/* Order form for selected outcome */}
      <OrderForm
        key={outcome}
        symbol={`${conditionId}:${outcome}`}
        assetType="PREDICTION"
        currentPrice={outcome === 'YES' ? yesPrice : noPrice}
        onSuccess={onSuccess}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/michael/paper-alpha && git add components/trading/prediction-order-form.tsx && git commit -m "feat: add PredictionOrderForm component with YES/NO token selector"
```

---

## Task 7: Asset Detail Page — PREDICTION Support

**Files:**
- Modify: `app/(dashboard)/markets/[symbol]/page.tsx`

- [ ] **Step 1: Add PREDICTION handling to the asset detail page**

Open `app/(dashboard)/markets/[symbol]/page.tsx`. Make three targeted changes:

**Change 1:** Add import for `PredictionOrderForm` at the top of the imports block (after the `OrderForm` import):

```typescript
import { PredictionOrderForm } from '@/components/trading/prediction-order-form'
```

**Change 2:** Find the asset type badge that shows `'CRYPTO'` or `'Stock'` (around line 80, inside the header section):

```typescript
              <span className="text-xs px-2 py-0.5 rounded bg-surface-2 border border-border text-text-muted">
                {assetType === 'CRYPTO' ? 'Crypto' : 'Stock'}
              </span>
```

Replace with:

```typescript
              <span className="text-xs px-2 py-0.5 rounded bg-surface-2 border border-border text-text-muted">
                {assetType === 'CRYPTO' ? 'Crypto' : assetType === 'PREDICTION' ? 'Prediction Market' : 'Stock'}
              </span>
```

**Change 3:** Find the order form + alert + stop-order block in the right column sidebar (the section that conditionally renders `OrderForm`):

```typescript
          {quote ? (
            <OrderForm symbol={symbol} assetType={assetType} currentPrice={quote.price} />
          ) : (
            <Skeleton className="h-80 w-full rounded-xl" />
          )}

          {/* Price Alert */}
          {quote && (
            <AlertForm symbol={symbol} assetType={assetType} currentPrice={quote.price} />
          )}

          {/* Stop-Loss / Take-Profit */}
          {quote && (
            <StopOrderForm
              symbol={symbol}
              assetType={assetType}
              currentPrice={quote.price}
              holdingQty={portfolio?.holdings.find(h => h.symbol === symbol)?.quantity ?? 0}
            />
          )}
```

Replace with:

```typescript
          {quote ? (
            assetType === 'PREDICTION' ? (
              <PredictionOrderForm
                conditionId={symbol}
                yesPrice={quote.yesPrice ?? quote.price}
                noPrice={quote.noPrice ?? (1 - quote.price)}
                question={quote.question ?? quote.name}
              />
            ) : (
              <OrderForm symbol={symbol} assetType={assetType} currentPrice={quote.price} />
            )
          ) : (
            <Skeleton className="h-80 w-full rounded-xl" />
          )}

          {/* Price Alert — not supported for prediction markets */}
          {quote && assetType !== 'PREDICTION' && (
            <AlertForm symbol={symbol} assetType={assetType} currentPrice={quote.price} />
          )}

          {/* Stop-Loss / Take-Profit — not supported for prediction markets */}
          {quote && assetType !== 'PREDICTION' && (
            <StopOrderForm
              symbol={symbol}
              assetType={assetType}
              currentPrice={quote.price}
              holdingQty={portfolio?.holdings.find(h => h.symbol === symbol)?.quantity ?? 0}
            />
          )}
```

**Change 4:** Find the Market Stats card that shows Open / High / Low / Prev Close / Market Cap. Add a "Resolves" row for prediction markets. Find the stats array:

```typescript
              {[
                { label: 'Open', value: formatCurrency(quote.open) },
                { label: "Today's High", value: formatCurrency(quote.high) },
                { label: "Today's Low", value: formatCurrency(quote.low) },
                { label: 'Prev. Close', value: formatCurrency(quote.previousClose) },
                ...(quote.marketCap ? [{ label: 'Market Cap', value: formatMarketCap(quote.marketCap) }] : []),
              ].map(({ label, value }) => (
```

Replace with:

```typescript
              {[
                ...(assetType !== 'PREDICTION' ? [
                  { label: 'Open', value: formatCurrency(quote.open) },
                  { label: "Today's High", value: formatCurrency(quote.high) },
                  { label: "Today's Low", value: formatCurrency(quote.low) },
                  { label: 'Prev. Close', value: formatCurrency(quote.previousClose) },
                ] : [
                  { label: 'YES Price', value: `${((quote.yesPrice ?? quote.price) * 100).toFixed(1)}¢` },
                  { label: 'NO Price', value: `${((quote.noPrice ?? (1 - quote.price)) * 100).toFixed(1)}¢` },
                  ...(quote.resolvesAt ? [{ label: 'Resolves', value: new Date(quote.resolvesAt * 1000).toLocaleDateString() }] : []),
                ]),
                ...(quote.marketCap ? [{ label: 'Market Cap', value: formatMarketCap(quote.marketCap) }] : []),
              ].map(({ label, value }) => (
```

- [ ] **Step 2: Commit**

```bash
cd /home/michael/paper-alpha && git add "app/(dashboard)/markets/[symbol]/page.tsx" && git commit -m "feat: add PREDICTION support to asset detail page"
```

---

## Task 8: Holdings Table — PREDICTION Display

**Files:**
- Modify: `components/portfolio/holdings-table.tsx`

- [ ] **Step 1: Fix link and display for prediction holdings**

In `components/portfolio/holdings-table.tsx`, find the `<Link>` element inside the holdings row (around line 325):

```typescript
                      <Link
                        href={`/markets/${h.symbol}?type=${h.assetType}`}
```

Replace with:

```typescript
                      <Link
                        href={
                          h.assetType === 'PREDICTION'
                            ? `/markets/${h.symbol.split(':')[0]}?type=PREDICTION`
                            : `/markets/${h.symbol}?type=${h.assetType}`
                        }
```

Find the symbol display inside that Link (the `<p>` that shows `h.symbol` and the sub-label that shows `h.assetType.toLowerCase()`):

```typescript
                          <p className="font-medium text-text-primary">{h.symbol}</p>
```

Replace with:

```typescript
                          <p className="font-medium text-text-primary truncate max-w-[200px]">
                            {h.assetType === 'PREDICTION'
                              ? (h.name ?? h.symbol)
                              : h.symbol}
                          </p>
```

Find the asset type sub-label:

```typescript
                        <p className="text-xs text-text-muted capitalize">{h.assetType.toLowerCase()}</p>
```

Replace with:

```typescript
                        <p className="text-xs text-text-muted capitalize">
                          {h.assetType === 'PREDICTION'
                            ? `${h.symbol.endsWith(':YES') ? 'YES' : 'NO'} · Prediction`
                            : h.assetType.toLowerCase()}
                        </p>
```

- [ ] **Step 2: Commit**

```bash
cd /home/michael/paper-alpha && git add components/portfolio/holdings-table.tsx && git commit -m "feat: display prediction holdings with question text and YES/NO label"
```

---

## Task 9: Resolution Cron

**Files:**
- Create: `app/api/cron/resolve-predictions/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create the resolution cron route**

Create `app/api/cron/resolve-predictions/route.ts`:

```typescript
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { Decimal } from 'decimal.js'

const CLOB_BASE = 'https://clob.polymarket.com'

interface CLOBMarketStatus {
  condition_id: string
  closed: boolean
  active: boolean
  tokens: Array<{ token_id: string; outcome: string; price: number }>
}

// Called hourly by Vercel Cron. Protected by CRON_SECRET.
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const authHeader = req.headers.get('authorization')
  const expected = `Bearer ${cronSecret}`
  let authorized = false
  try {
    authorized =
      authHeader !== null &&
      authHeader.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  } catch {
    authorized = false
  }
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find all open prediction holdings
  const holdings = await db.holding.findMany({
    where: { assetType: 'PREDICTION' },
    include: { account: true },
  })

  if (holdings.length === 0) {
    return NextResponse.json({ ok: true, settled: 0, checked: 0 })
  }

  // Deduplicate conditionIds
  const uniqueConditionIds = [
    ...new Set(holdings.map(h => h.symbol.split(':')[0])),
  ]

  // Fetch market status for each conditionId
  const marketStatuses = new Map<string, CLOBMarketStatus>()
  await Promise.allSettled(
    uniqueConditionIds.map(async conditionId => {
      try {
        const res = await fetch(`${CLOB_BASE}/markets/${conditionId}`, { cache: 'no-store' })
        if (!res.ok) return
        const market: CLOBMarketStatus = await res.json()
        marketStatuses.set(conditionId, market)
      } catch {
        // Skip markets that fail to fetch — retry on next cron run
      }
    })
  )

  let settled = 0
  const errors: string[] = []

  for (const holding of holdings) {
    const conditionId = holding.symbol.split(':')[0]
    const side = holding.symbol.split(':')[1] ?? 'YES'
    const market = marketStatuses.get(conditionId)

    if (!market?.closed) continue  // Market still active

    // Determine settlement price
    const yesToken = market.tokens.find(t => t.outcome === 'Yes')
    const noToken = market.tokens.find(t => t.outcome === 'No')

    // On Polymarket: resolved YES token → price ~1.0, resolved NO token → price ~0.0
    const resolvedYes = yesToken ? yesToken.price > 0.99 : false
    const settlementPrice = side === 'YES'
      ? (resolvedYes ? 1.0 : 0.0)
      : (resolvedYes ? 0.0 : 1.0)

    const quantity = new Decimal(holding.quantity)
    const totalValue = quantity.mul(settlementPrice)
    const costBasis = new Decimal(holding.avgCostBasis)
    const realizedPnl = totalValue.minus(quantity.mul(costBasis))

    try {
      await db.$transaction(async tx => {
        // Record a SELL trade at settlement price
        await tx.trade.create({
          data: {
            accountId: holding.accountId,
            symbol: holding.symbol,
            assetType: 'PREDICTION',
            assetName: `${conditionId.slice(0, 10)}... (settled)`,
            side: 'SELL',
            quantity: quantity.abs(),
            price: new Decimal(settlementPrice),
            totalValue,
            reason: `Market resolved: ${resolvedYes ? 'YES' : 'NO'}`,
          },
        })

        // Credit cash (NO tokens that resolved worthless credit $0)
        if (totalValue.greaterThan(0)) {
          await tx.paperAccount.update({
            where: { id: holding.accountId },
            data: {
              cashBalance: {
                increment: totalValue.toNumber(),
              },
            },
          })
        }

        // Update realized P&L and remove holding
        await tx.holding.update({
          where: { id: holding.id },
          data: {
            realizedPnl: new Decimal(holding.realizedPnl).plus(realizedPnl),
            quantity: new Decimal(0),
          },
        })

        // Delete zero-quantity holding
        await tx.holding.delete({ where: { id: holding.id } })
      })

      settled++
    } catch (err) {
      errors.push(`${holding.symbol}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return NextResponse.json({
    ok: true,
    checked: uniqueConditionIds.length,
    settled,
    errors,
    timestamp: new Date().toISOString(),
  })
}
```

- [ ] **Step 2: Add hourly cron schedule to vercel.json**

Open `vercel.json`. Add the new cron entry to the `"crons"` array:

```json
{
  "crons": [
    {
      "path": "/api/cron/snapshots",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/bot-trade",
      "schedule": "0 10 * * *"
    },
    {
      "path": "/api/cron/bot?offset=0&limit=15",
      "schedule": "10 20 * * *"
    },
    {
      "path": "/api/cron/bot?offset=15&limit=15",
      "schedule": "20 20 * * *"
    },
    {
      "path": "/api/cron/bot?offset=30&limit=13",
      "schedule": "30 20 * * *"
    },
    {
      "path": "/api/cron/resolve-predictions",
      "schedule": "0 * * * *"
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
cd /home/michael/paper-alpha && git add "app/api/cron/resolve-predictions/route.ts" vercel.json && git commit -m "feat: add hourly resolution cron for settled Polymarket positions"
```

---

## Self-Review Notes

- **Spec § 1 (Data Model):** Tasks 1–4 cover `AssetType`, `Quote` extension, `Holding.name`, and DB migration. ✓
- **Spec § 2 (Market Data Layer):** Tasks 2–3 cover `polymarket.ts` and index wiring. ✓
- **Spec § 3 (Trading & Resolution):** Existing `executeTrade()` unchanged; Task 9 covers settlement cron. ✓
- **Spec § 4 (UI):** Tasks 5–8 cover markets page tab, order form, asset detail, and holdings display. ✓
- **Spec § 5 (Error Handling):** Graceful degradation in `getTrendingPredictions` (Promise.allSettled) and cron (per-market try/catch) covered inline. ✓
- **Spec § 6 (Testing):** Task 2 covers unit tests for all pure mapping functions. ✓
- **Type consistency check:** `mapCLOBMarketToQuote`, `mapGammaMarketToTrendingAsset`, `mapPriceHistoryToCandles` are exported in Task 2 and imported in tests — names match throughout. ✓
- **Symbol format `{conditionId}:YES`/`{conditionId}:NO`** used consistently across Tasks 2, 6, 7, 8, 9. ✓
