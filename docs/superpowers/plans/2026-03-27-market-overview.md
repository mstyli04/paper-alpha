# Market Overview Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Market Overview panel to the top of the Analysis page showing major indices, an 11-sector heat map, and top movers from the trading universe.

**Architecture:** Three data-fetching functions in a new `lib/market-data/overview.ts` module fetch Yahoo Finance quotes in parallel for indices (^GSPC, ^IXIC, ^DJI, ^RUT), all 11 SPDR sector ETFs, and stock-only universe symbols. A single API route `/api/market/overview` calls all three, uses `Promise.allSettled` so each section degrades independently, and caches for 5 minutes. A client component `MarketOverview` fetches with SWR and renders three sub-components in the layout: full-width indices bar, then sectors (2/3 wide) and top movers (1/3 wide) side by side.

**Tech Stack:** Next.js 14 App Router, Yahoo Finance (yahoo-finance2), SWR, Tailwind CSS, Vitest

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `lib/market-data/overview.ts` | Create | Data fetching: getIndices, getSectors, getTopMovers + pickMovers helper |
| `app/api/market/overview/route.ts` | Create | Authenticated API route, 5-min cache |
| `components/markets/market-overview.tsx` | Create | UI: IndicesBar, SectorHeatmap, TopMovers + sectorColor helper |
| `app/(dashboard)/analysis/page.tsx` | Modify | Import and render `<MarketOverview />` above `<Screener />` |
| `__tests__/market-data/overview.test.ts` | Create | Unit tests for sectorColor and pickMovers |

---

## Task 1: Data fetching module with tests (TDD)

**Files:**
- Create: `lib/market-data/overview.ts`
- Create: `__tests__/market-data/overview.test.ts`

**Context:** Yahoo Finance is already used in `lib/market-data/binance.ts` and `lib/market-data/yahoo.ts`. The pattern for calling it is `(yf as any).quote(ticker, {}, { validateResult: false })` which returns an object with fields like `regularMarketPrice`, `regularMarketChange`, `regularMarketChangePercent`. Import `UNIVERSE` from `lib/bot/universe.ts` to get the stock list — filter to `assetType === 'STOCK'` to exclude crypto.

- [ ] **Step 1: Write failing tests for `sectorColor` and `pickMovers`**

Create `__tests__/market-data/overview.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sectorColor, pickMovers } from '@/lib/market-data/overview'
import type { MoverData } from '@/lib/market-data/overview'

describe('sectorColor', () => {
  it('returns white-on-green for strong gain (> +2%)', () => {
    expect(sectorColor(3)).toBe('bg-green text-white')
    expect(sectorColor(2.1)).toBe('bg-green text-white')
  })
  it('returns light green for moderate gain (+0.5% to +2%)', () => {
    expect(sectorColor(1)).toBe('bg-green/20 text-green')
    expect(sectorColor(0.5)).toBe('bg-green/20 text-green')
  })
  it('returns neutral for flat (-0.5% to +0.5%)', () => {
    expect(sectorColor(0)).toBe('bg-surface-2 text-text-muted')
    expect(sectorColor(0.4)).toBe('bg-surface-2 text-text-muted')
    expect(sectorColor(-0.4)).toBe('bg-surface-2 text-text-muted')
  })
  it('returns light red for moderate loss (-2% to -0.5%)', () => {
    expect(sectorColor(-1)).toBe('bg-red/20 text-red')
    expect(sectorColor(-0.6)).toBe('bg-red/20 text-red')
  })
  it('returns white-on-red for large loss (< -2%)', () => {
    expect(sectorColor(-3)).toBe('bg-red text-white')
    expect(sectorColor(-2.1)).toBe('bg-red text-white')
  })
})

describe('pickMovers', () => {
  const data: MoverData[] = [
    { symbol: 'A', price: 10, changePercent: 5.0 },
    { symbol: 'B', price: 20, changePercent: -3.0 },
    { symbol: 'C', price: 30, changePercent: 2.0 },
    { symbol: 'D', price: 40, changePercent: -1.0 },
    { symbol: 'E', price: 50, changePercent: 0.5 },
  ]

  it('returns top n gainers sorted descending', () => {
    const { gainers } = pickMovers(data, 3)
    expect(gainers.map(m => m.symbol)).toEqual(['A', 'C', 'E'])
  })

  it('returns top n losers sorted worst-first', () => {
    const { losers } = pickMovers(data, 2)
    expect(losers.map(m => m.symbol)).toEqual(['B', 'D'])
  })

  it('does not mutate the input array', () => {
    const copy = [...data]
    pickMovers(data, 3)
    expect(data).toEqual(copy)
  })

  it('handles n larger than array length gracefully', () => {
    const { gainers } = pickMovers(data, 10)
    expect(gainers.length).toBeLessThanOrEqual(data.length)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/michael/paper-alpha && npx vitest run __tests__/market-data/overview.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/market-data/overview'`

- [ ] **Step 3: Create `lib/market-data/overview.ts`**

```ts
import YahooFinance from 'yahoo-finance2'
import { UNIVERSE } from '@/lib/bot/universe'

const yf = new YahooFinance()

const INDEX_LIST = [
  { label: 'S&P 500', ticker: '^GSPC' },
  { label: 'Nasdaq',  ticker: '^IXIC' },
  { label: 'Dow',     ticker: '^DJI'  },
  { label: 'Russell', ticker: '^RUT'  },
]

const SECTOR_LIST = [
  { name: 'Technology',       ticker: 'XLK'  },
  { name: 'Financials',       ticker: 'XLF'  },
  { name: 'Energy',           ticker: 'XLE'  },
  { name: 'Health Care',      ticker: 'XLV'  },
  { name: 'Industrials',      ticker: 'XLI'  },
  { name: 'Cons. Staples',    ticker: 'XLP'  },
  { name: 'Cons. Disc.',      ticker: 'XLY'  },
  { name: 'Real Estate',      ticker: 'XLRE' },
  { name: 'Materials',        ticker: 'XLB'  },
  { name: 'Utilities',        ticker: 'XLU'  },
  { name: 'Comm. Services',   ticker: 'XLC'  },
]

export interface IndexData {
  label: string
  ticker: string
  price: number
  change: number
  changePercent: number
}

export interface SectorData {
  name: string
  ticker: string
  changePercent: number
}

export interface MoverData {
  symbol: string
  price: number
  changePercent: number
}

export interface OverviewData {
  indices: IndexData[]
  sectors: SectorData[]
  movers: { gainers: MoverData[]; losers: MoverData[] }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchQuote(ticker: string): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (yf as any).quote(ticker, {}, { validateResult: false })
}

export function sectorColor(changePercent: number): string {
  if (changePercent > 2)    return 'bg-green text-white'
  if (changePercent > 0.5)  return 'bg-green/20 text-green'
  if (changePercent >= -0.5) return 'bg-surface-2 text-text-muted'
  if (changePercent > -2)   return 'bg-red/20 text-red'
  return 'bg-red text-white'
}

export function pickMovers(
  movers: MoverData[],
  n: number
): { gainers: MoverData[]; losers: MoverData[] } {
  const sorted = [...movers].sort((a, b) => b.changePercent - a.changePercent)
  return {
    gainers: sorted.slice(0, n),
    losers: sorted.slice(-n).reverse(),
  }
}

export async function getIndices(): Promise<IndexData[]> {
  const results = await Promise.allSettled(INDEX_LIST.map(({ ticker }) => fetchQuote(ticker)))
  return results.map((r, i) => ({
    label: INDEX_LIST[i].label,
    ticker: INDEX_LIST[i].ticker,
    price: r.status === 'fulfilled' ? (r.value?.regularMarketPrice ?? 0) : 0,
    change: r.status === 'fulfilled' ? (r.value?.regularMarketChange ?? 0) : 0,
    changePercent: r.status === 'fulfilled' ? (r.value?.regularMarketChangePercent ?? 0) : 0,
  }))
}

export async function getSectors(): Promise<SectorData[]> {
  const results = await Promise.allSettled(SECTOR_LIST.map(({ ticker }) => fetchQuote(ticker)))
  return results.map((r, i) => ({
    name: SECTOR_LIST[i].name,
    ticker: SECTOR_LIST[i].ticker,
    changePercent: r.status === 'fulfilled' ? (r.value?.regularMarketChangePercent ?? 0) : 0,
  }))
}

export async function getTopMovers(): Promise<{ gainers: MoverData[]; losers: MoverData[] }> {
  const stockSymbols = UNIVERSE.filter(a => a.assetType === 'STOCK').map(a => a.symbol)
  const results = await Promise.allSettled(stockSymbols.map(s => fetchQuote(s)))

  const movers: MoverData[] = results
    .map((r, i) => ({
      symbol: stockSymbols[i],
      price: r.status === 'fulfilled' ? (r.value?.regularMarketPrice ?? 0) : 0,
      changePercent: r.status === 'fulfilled' ? (r.value?.regularMarketChangePercent ?? 0) : 0,
    }))
    .filter(m => m.price > 0)

  return pickMovers(movers, 3)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/michael/paper-alpha && npx vitest run __tests__/market-data/overview.test.ts
```

Expected: all 9 tests pass

- [ ] **Step 5: Commit**

```bash
cd /home/michael/paper-alpha
git add lib/market-data/overview.ts __tests__/market-data/overview.test.ts
git commit -m "feat: add market overview data module (getIndices, getSectors, getTopMovers)"
```

---

## Task 2: API route

**Files:**
- Create: `app/api/market/overview/route.ts`

**Context:** Look at `app/api/market/trending/route.ts` for the exact auth + cache-header pattern. It uses `auth()` from `@clerk/nextjs/server`, returns `NextResponse.json()`, and adds `Cache-Control` headers. No unit tests for this task — it's glue code.

- [ ] **Step 1: Create `app/api/market/overview/route.ts`**

```ts
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getIndices, getSectors, getTopMovers } from '@/lib/market-data/overview'

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [indicesResult, sectorsResult, moversResult] = await Promise.allSettled([
    getIndices(),
    getSectors(),
    getTopMovers(),
  ])

  return NextResponse.json(
    {
      indices: indicesResult.status === 'fulfilled' ? indicesResult.value : [],
      sectors: sectorsResult.status === 'fulfilled' ? sectorsResult.value : [],
      movers:  moversResult.status === 'fulfilled'  ? moversResult.value  : { gainers: [], losers: [] },
    },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } }
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd /home/michael/paper-alpha && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing errors unrelated to the new file)

- [ ] **Step 3: Commit**

```bash
cd /home/michael/paper-alpha
git add app/api/market/overview/route.ts
git commit -m "feat: add /api/market/overview route with 5-min cache"
```

---

## Task 3: MarketOverview UI component

**Files:**
- Create: `components/markets/market-overview.tsx`

**Context:** Follow the exact pattern from `components/markets/correlation-heatmap.tsx`: `'use client'`, `useSWR` with `fetcher = (url) => fetch(url).then(r => r.json())`, `Skeleton` from `@/components/ui/skeleton` for loading state, `revalidateOnFocus: false`. Use `pnlColor` and `formatPercent` from `@/lib/utils` — `formatPercent(1.23)` returns `'+1.23%'` and `pnlColor(1.23)` returns `'text-green'`. Import the types and `sectorColor` from `@/lib/market-data/overview`. Tailwind colour names in this project are `text-green`, `text-red`, `bg-green`, `bg-red`, `bg-green/20`, `bg-red/20`, `bg-surface-2`, `text-text-muted`, `text-text-primary`, `border-border`, `card` (card container class).

- [ ] **Step 1: Create `components/markets/market-overview.tsx`**

```tsx
'use client'

import useSWR from 'swr'
import { Skeleton } from '@/components/ui/skeleton'
import { pnlColor, formatPercent } from '@/lib/utils'
import { sectorColor } from '@/lib/market-data/overview'
import type { OverviewData, IndexData, SectorData, MoverData } from '@/lib/market-data/overview'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function IndicesBar({ indices }: { indices: IndexData[] }) {
  return (
    <div className="card p-4">
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        {indices.map(idx => (
          <div key={idx.ticker} className="flex items-center gap-2">
            <span className="text-xs text-text-muted font-medium">{idx.label}</span>
            <span className="text-sm font-semibold text-text-primary">
              {idx.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
            <span className={`text-xs font-medium ${pnlColor(idx.changePercent)}`}>
              {formatPercent(idx.changePercent)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SectorHeatmap({ sectors }: { sectors: SectorData[] }) {
  return (
    <div className="card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">Sectors — Today</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {sectors.map(s => (
          <div
            key={s.ticker}
            className={`rounded-lg p-2 text-center ${sectorColor(s.changePercent)}`}
          >
            <div className="text-xs font-medium truncate">{s.name}</div>
            <div className="text-sm font-bold mt-0.5">{formatPercent(s.changePercent)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TopMovers({ movers }: { movers: { gainers: MoverData[]; losers: MoverData[] } }) {
  return (
    <div className="card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">Top Movers</h3>
      <div>
        <div className="text-xs text-text-muted uppercase tracking-wide mb-1.5">Gainers</div>
        <div className="space-y-1.5">
          {movers.gainers.map(m => (
            <div key={m.symbol} className="flex justify-between items-center">
              <span className="text-sm font-medium text-text-primary">{m.symbol}</span>
              <span className="text-sm font-medium text-green">{formatPercent(m.changePercent)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-border" />
      <div>
        <div className="text-xs text-text-muted uppercase tracking-wide mb-1.5">Losers</div>
        <div className="space-y-1.5">
          {movers.losers.map(m => (
            <div key={m.symbol} className="flex justify-between items-center">
              <span className="text-sm font-medium text-text-primary">{m.symbol}</span>
              <span className="text-sm font-medium text-red">{formatPercent(m.changePercent)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MarketOverview() {
  const { data, isLoading } = useSWR<OverviewData>('/api/market/overview', fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-3">
      <IndicesBar indices={data.indices} />
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <SectorHeatmap sectors={data.sectors} />
        <TopMovers movers={data.movers} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
cd /home/michael/paper-alpha && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
cd /home/michael/paper-alpha
git add components/markets/market-overview.tsx
git commit -m "feat: add MarketOverview component (IndicesBar, SectorHeatmap, TopMovers)"
```

---

## Task 4: Wire up in the Analysis page

**Files:**
- Modify: `app/(dashboard)/analysis/page.tsx`

**Context:** Current file at `app/(dashboard)/analysis/page.tsx` renders `<Screener />`, `<EarningsCalendar />`, and `<CorrelationHeatmap />`. Add `<MarketOverview />` as the first item inside the `space-y-6` container, before `<Screener />`. Also add a heading for the new section.

- [ ] **Step 1: Update `app/(dashboard)/analysis/page.tsx`**

Replace the entire file with:

```tsx
'use client'

import { CorrelationHeatmap } from '@/components/markets/correlation-heatmap'
import { Screener } from '@/components/markets/screener'
import { EarningsCalendar } from '@/components/markets/earnings-calendar'
import { MarketOverview } from '@/components/markets/market-overview'

export default function AnalysisPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Analysis</h1>
        <p className="text-text-muted text-sm mt-1">Market overview, screener, and market events</p>
      </div>

      <MarketOverview />

      <Screener />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EarningsCalendar />
        <CorrelationHeatmap />
      </div>

      <p className="text-xs text-text-muted text-center">
        Correlations based on 90 days of daily returns. Past correlations do not guarantee future relationships.
        Not financial advice.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
cd /home/michael/paper-alpha && npx vitest run
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
cd /home/michael/paper-alpha
git add app/(dashboard)/analysis/page.tsx
git commit -m "feat: add MarketOverview panel to Analysis page"
```

---

## Manual Verification Checklist

After all tasks are complete, open the app and check `/analysis`:

- [ ] Indices bar shows S&P 500, Nasdaq, Dow, Russell with prices and % change
- [ ] All 11 sectors appear in the heat map with coloured backgrounds
- [ ] Positive sectors are green, negative are red
- [ ] Top movers shows 3 gainers and 3 losers (stock symbols only — no BTC, ETH, etc.)
- [ ] Loading skeletons appear briefly before data loads
- [ ] The existing Screener, Earnings Calendar, and Correlation Heatmap are unchanged below
