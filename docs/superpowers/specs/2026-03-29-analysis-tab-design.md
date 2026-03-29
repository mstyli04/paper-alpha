# Analysis Tab — Design Spec
**Date:** 2026-03-29
**Project:** Paper Alpha
**Status:** Approved

---

## Problem

The analysis tab exists but is a single long scroll with four components. Several built components (`NewsFeed`, `InsiderFeed`, `RedditActivity`) and one existing API route (`/api/market/trending`) are not surfaced there at all. As more components get added, the page becomes unwieldy.

---

## Solution

Reorganise the analysis page into four URL-driven tabs. Wire up the three orphaned components and build a `TrendingAssets` component for the existing trending route.

---

## Scope

**Modified files:**
- `app/(dashboard)/analysis/page.tsx` — replace with tabbed layout

**New files:**
- `components/markets/trending-assets.tsx` — trending stocks/crypto/commodities

**Unchanged:** all other components, all API routes, database schema

---

## Tab Layout

### Tab navigation

Row of four buttons at the top of the page, styled consistently with the rest of the app:

```tsx
const TABS = ['overview', 'screener', 'news', 'correlations'] as const
type Tab = typeof TABS[number]

const TAB_LABELS: Record<Tab, string> = {
  overview:     'Overview',
  screener:     'Screener',
  news:         'News & Signals',
  correlations: 'Correlations',
}
```

Active tab style: `bg-brand/10 text-brand`
Inactive tab style: `text-text-muted hover:text-text-primary`

### URL routing

```typescript
'use client'

import { useSearchParams, useRouter } from 'next/navigation'

const searchParams = useSearchParams()
const router = useRouter()
const tab = (searchParams.get('tab') ?? 'overview') as Tab

function setTab(t: Tab) {
  router.replace(`/analysis?tab=${t}`, { scroll: false })
}
```

Default tab: `overview` (when no `?tab=` param is present).

### Lazy mounting

Each tab's content is only rendered when the tab is active:

```tsx
{tab === 'overview'     && <OverviewTab />}
{tab === 'screener'     && <ScreenerTab />}
{tab === 'news'         && <NewsTab />}
{tab === 'correlations' && <CorrelationsTab />}
```

This prevents the Screener, News, and Correlations tabs from making API calls on initial page load.

---

## Tab Content

### Overview tab

```
┌─────────────────────────────────────────┐
│  MarketOverview                         │  ← indices bar + sector heatmap + movers
├─────────────────────────────────────────┤
│  TrendingAssets                         │  ← new component
└─────────────────────────────────────────┘
```

### Screener tab

```
┌─────────────────────────────────────────┐
│  Screener                               │  ← existing, unchanged
└─────────────────────────────────────────┘
```

### News & Signals tab

```
┌─────────────────────────────────────────┐
│  NewsFeed (full width)                  │
├───────────────────────┬─────────────────┤
│  InsiderFeed          │  RedditActivity │
└───────────────────────┴─────────────────┘
```

### Correlations tab

```
┌───────────────────────┬─────────────────┐
│  CorrelationHeatmap   │ EarningsCalendar│
└───────────────────────┴─────────────────┘
```

Same layout as today.

---

## TrendingAssets Component

**File:** `components/markets/trending-assets.tsx`

Fetches `/api/market/trending` with SWR. Revalidates every 2 minutes (`refreshInterval: 120_000`), matching the route's cache TTL.

### Response shape (from existing route)

Uses the existing `TrendingAsset` type from `@/types`:

```typescript
import type { TrendingAsset } from '@/types'

interface TrendingData {
  stocks:      TrendingAsset[]
  crypto:      TrendingAsset[]
  commodities: TrendingAsset[]
}

// TrendingAsset has: symbol, name, description?, price, changePercent, assetType, logoUrl?
```

### Layout

Three equal columns inside a card:

```
┌──────────────┬──────────────┬──────────────┐
│ Stocks       │ Crypto       │ Commodities  │
│ AAPL  +1.2%  │ BTC   +2.3%  │ GLD   -0.4%  │
│ NVDA  +0.8%  │ ETH   +1.1%  │ OIL   +0.9%  │
│ ...          │ ...          │ ...          │
└──────────────┴──────────────┴──────────────┘
```

Each row: symbol (left, `text-sm font-medium`) + % change (right, green/red).
Name shown as `text-xs text-text-muted` below symbol.

Loading state: skeleton rows.
Empty/error state: silent (renders nothing if all three lists are empty).

### Props

None — self-contained.

---

## Page Header

The existing `<h1>Analysis</h1>` and subtitle remain. The tab nav renders below the header, above the tab content.

---

## Testing

No new unit tests — all UI components with no extractable logic. The existing 60 tests must remain green.
