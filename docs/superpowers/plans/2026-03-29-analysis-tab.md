# Analysis Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-scroll analysis page with four URL-driven tabs (Overview, Screener, News & Signals, Correlations) and surface existing orphaned components plus a new TrendingAssets widget.

**Architecture:** Two files change. `TrendingAssets` is a new self-contained component. `analysis/page.tsx` is replaced with a client component that reads `?tab=` from search params and mounts only the active tab's content (lazy). Each tab is an inner component to satisfy Rules of Hooks.

**Tech Stack:** TypeScript, React hooks, Next.js App Router (`useSearchParams`, `useRouter`), SWR, Tailwind CSS, Vitest

---

## File Map

| File | Change |
|------|--------|
| `components/markets/trending-assets.tsx` | Create — fetches `/api/market/trending`, renders 3-column Stocks / Crypto / Commodities card |
| `app/(dashboard)/analysis/page.tsx` | Replace — URL-driven tab layout with 4 inner tab components |

---

### Task 1: Build `TrendingAssets` component

**Files:**
- Create: `components/markets/trending-assets.tsx`

- [ ] **Step 1: Verify baseline tests pass**

```bash
npm test 2>&1 | tail -6
```

Expected: 5 test files, 60 tests, all passing.

- [ ] **Step 2: Create `components/markets/trending-assets.tsx`**

```typescript
'use client'

import useSWR from 'swr'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, pnlColor, formatPercent } from '@/lib/utils'
import type { TrendingAsset } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface TrendingData {
  stocks:      TrendingAsset[]
  crypto:      TrendingAsset[]
  commodities: TrendingAsset[]
}

function TrendingColumn({ title, items }: { title: string; items: TrendingAsset[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">{title}</h4>
      <div className="space-y-2.5">
        {items.slice(0, 5).map(item => (
          <div key={item.symbol} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{item.symbol}</p>
              <p className="text-xs text-text-muted truncate">{item.name}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-mono text-text-primary">{formatCurrency(item.price)}</p>
              <p className={`text-xs font-medium ${pnlColor(item.changePercent)}`}>
                {formatPercent(item.changePercent)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TrendingAssets() {
  const { data, isLoading } = useSWR<TrendingData>(
    '/api/market/trending',
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 120_000 }
  )

  const isEmpty = !data || (
    data.stocks.length === 0 &&
    data.crypto.length === 0 &&
    data.commodities.length === 0
  )

  if (!isLoading && isEmpty) return null

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-4">Trending</h3>
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-9 w-full" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <TrendingColumn title="Stocks"      items={data!.stocks} />
          <TrendingColumn title="Crypto"      items={data!.crypto} />
          <TrendingColumn title="Commodities" items={data!.commodities} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Run tests**

```bash
npm test 2>&1 | tail -6
```

Expected: 5 test files, 60 tests, all passing. (No new tests — UI-only component with no extractable logic.)

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/markets/trending-assets.tsx
git commit -m "feat(analysis): add TrendingAssets component"
```

---

### Task 2: Replace `analysis/page.tsx` with tabbed layout

**Files:**
- Modify: `app/(dashboard)/analysis/page.tsx`

The existing file is a simple server component with 4 components stacked. Read it first, then replace entirely.

**Context on inner tab components:**

Each tab is extracted as an inner component so that `useSWR` and `useState` hooks are called unconditionally (React Rules of Hooks). The outer `AnalysisPage` mounts only the active tab via `{tab === 'news' && <NewsTab />}` — this means the News tab's SWR fetch doesn't run until the user visits that tab.

**Context on `NewsFeed` and `InsiderFeed`:**

`NewsFeed` (`components/markets/news-feed.tsx`) requires `symbol` and `assetType` props — it's a per-symbol component used on the market detail page. For the analysis tab we fetch general market news directly from `/api/market/news/general` inline in `NewsTab`.

`InsiderFeed` (`components/markets/insider-feed.tsx`) and `RedditActivity` (`components/markets/reddit-activity.tsx`) also require a `symbol` prop. `NewsTab` provides a symbol input (defaults to `SPY`) that drives both.

- [ ] **Step 1: Replace `app/(dashboard)/analysis/page.tsx`**

```typescript
'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo, pnlColor } from '@/lib/utils'
import { MarketOverview } from '@/components/markets/market-overview'
import { TrendingAssets } from '@/components/markets/trending-assets'
import { Screener } from '@/components/markets/screener'
import { InsiderFeed } from '@/components/markets/insider-feed'
import { RedditActivity } from '@/components/markets/reddit-activity'
import { CorrelationHeatmap } from '@/components/markets/correlation-heatmap'
import { EarningsCalendar } from '@/components/markets/earnings-calendar'

const TABS = ['overview', 'screener', 'news', 'correlations'] as const
type Tab = typeof TABS[number]

const TAB_LABELS: Record<Tab, string> = {
  overview:     'Overview',
  screener:     'Screener',
  news:         'News & Signals',
  correlations: 'Correlations',
}

// ── Tab components ────────────────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div className="space-y-6">
      <MarketOverview />
      <TrendingAssets />
    </div>
  )
}

function ScreenerTab() {
  return <Screener />
}

interface NewsItem {
  id: number | string
  headline: string
  summary: string
  source: string
  url: string
  datetime: number
  sentiment: 'positive' | 'negative' | 'neutral'
}

const sentimentStyles = {
  positive: 'bg-green/10 text-green',
  negative: 'bg-red/10 text-red',
  neutral:  'bg-text-muted/10 text-text-muted',
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

function NewsTab() {
  const [symbol, setSymbol] = useState('SPY')
  const [input,  setInput]  = useState('SPY')

  const { data: news, isLoading: newsLoading } = useSWR<NewsItem[]>(
    '/api/market/news/general?category=general',
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 300_000 }
  )

  function applySymbol() {
    const clean = input.trim().toUpperCase()
    if (clean) setSymbol(clean)
  }

  return (
    <div className="space-y-6">
      {/* General market news */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">Market News</h3>
          <Link href="/news" className="text-xs text-brand hover:underline">
            View all →
          </Link>
        </div>

        {newsLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        ) : !news?.length ? (
          <p className="px-5 py-8 text-center text-text-muted text-sm">No news available</p>
        ) : (
          <div className="divide-y divide-border">
            {news.slice(0, 8).map(item => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 px-5 py-3.5 hover:bg-surface-2/50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-text-primary group-hover:text-brand transition-colors line-clamp-2 leading-snug">
                      {item.headline}
                    </p>
                    <ExternalLink className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${sentimentStyles[item.sentiment]}`}>
                      {item.sentiment}
                    </span>
                    <span className="text-xs text-text-muted">{item.source}</span>
                    <span className="text-xs text-text-muted">·</span>
                    <span className="text-xs text-text-muted">{timeAgo(new Date(item.datetime * 1000))}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Per-symbol signals */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-text-primary">Symbol Signals</h3>
          <div className="flex gap-2 ml-auto">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applySymbol()}
              placeholder="e.g. AAPL"
              className="input-base w-28 text-xs"
            />
            <button onClick={applySymbol} className="btn-primary text-xs px-3">
              Go
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InsiderFeed symbol={symbol} />
          <RedditActivity symbol={symbol} />
        </div>
      </div>
    </div>
  )
}

function CorrelationsTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CorrelationHeatmap />
        <EarningsCalendar />
      </div>
      <p className="text-xs text-text-muted text-center">
        Correlations based on 90 days of daily returns. Past correlations do not guarantee future relationships.
        Not financial advice.
      </p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalysisPage() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const rawTab = searchParams.get('tab')
  const tab: Tab = (TABS as readonly string[]).includes(rawTab ?? '') ? rawTab as Tab : 'overview'

  function setTab(t: Tab) {
    router.replace(`/analysis?tab=${t}`, { scroll: false })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Analysis</h1>
        <p className="text-text-muted text-sm mt-1">Market overview, screener, and market events</p>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-border pb-0">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t transition-colors -mb-px ${
              tab === t
                ? 'bg-brand/10 text-brand border border-border border-b-surface-1'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab content — lazy mounted */}
      {tab === 'overview'     && <OverviewTab />}
      {tab === 'screener'     && <ScreenerTab />}
      {tab === 'news'         && <NewsTab />}
      {tab === 'correlations' && <CorrelationsTab />}
    </div>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
npm test 2>&1 | tail -6
```

Expected: 5 test files, 60 tests, all passing.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Visual check in dev server**

```bash
npm run dev
```

Navigate to `/analysis`. Confirm:
- Four tab buttons appear: Overview, Screener, News & Signals, Correlations
- Overview tab (default) shows MarketOverview and TrendingAssets
- Clicking Screener shows the sortable stock table, hides Overview content
- Clicking News & Signals shows market news list + Symbol Signals section (default SPY)
- Entering a symbol (e.g. AAPL) in the input and clicking Go updates InsiderFeed and RedditActivity
- Clicking Correlations shows CorrelationHeatmap and EarningsCalendar
- Refreshing the page with `?tab=screener` in the URL lands on the Screener tab
- Browser back/forward navigates between tabs

- [ ] **Step 5: Commit**

```bash
git add 'app/(dashboard)/analysis/page.tsx'
git commit -m "feat(analysis): tabbed layout with Overview, Screener, News & Signals, Correlations"
```
