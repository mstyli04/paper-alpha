# Polymarket Integration Design

**Date:** 2026-04-05  
**Status:** Approved

## Overview

Add Polymarket prediction markets to paper-alpha as a new asset class. Users can paper-trade YES/NO outcome tokens across categorised markets. Positions auto-settle via cron when markets resolve, and users can exit early at market price at any time.

## Scope

- Full YES/NO token trading (not browse-only)
- Category-filtered market browser (Politics, Crypto, Sports, Business, World)
- Auto-settlement cron + early manual exit
- New "Predictions" tab on existing markets page

Out of scope: alerts for prediction markets, bot trading predictions, screener integration.

---

## 1. Data Model & Types

### `AssetType` enum
Add `PREDICTION` to both `prisma/schema.prisma` and `types/index.ts`.

### `Quote` type extensions (all optional)
```ts
question?: string          // "Will X win the election?"
yesPrice?: number          // 0–1 probability (the YES token price)
noPrice?: number           // 0–1 (≈ 1 - yesPrice)
resolvesAt?: number        // Unix timestamp of market expiry
resolved?: boolean         // has the market settled?
resolvedOutcome?: 'YES' | 'NO'
conditionId?: string       // Polymarket hex market ID
```

### Standard `Quote` field mapping
| Quote field      | Prediction market value           |
|------------------|-----------------------------------|
| `price`          | `yesPrice`                        |
| `change`         | 24h absolute change of YES token  |
| `changePercent`  | 24h % change of YES token         |
| `high` / `low`   | 24h range of YES token            |
| `volume`         | market trading volume             |
| `name`           | truncated question text           |

### Symbol format
Each market has two tradeable tokens stored as separate `Holding`/`Trade` rows:
- `{conditionId}:YES` — YES token
- `{conditionId}:NO` — NO token

The `conditionId` is a Polymarket hex string (e.g. `0xabc123...`). Storing it as the symbol requires no schema changes.

### Settlement values
- YES token resolves → $1.00/share
- NO token resolves → $0.00/share (full loss, holding deleted)

---

## 2. Market Data Layer

### New file: `lib/market-data/polymarket.ts`
Uses Polymarket CLOB API (public, no API key required for read-only).

Exports:
- `getPolymarketQuote(conditionId: string): Promise<Quote>`
- `getPolymarketCandles(conditionId: string, from: number, to: number): Promise<CandleData[]>` — price history of YES token mapped to OHLCV
- `getTrendingPredictions(): Promise<TrendingAsset[]>` — top markets by volume, categories: Politics, Crypto, Sports, Business, World
- `searchPredictions(query: string): Promise<SearchResult[]>` — search by market title

### Changes to `lib/market-data/index.ts`
- `getQuote()`: routes `PREDICTION` → `getPolymarketQuote(conditionId)` (strips `:YES`/`:NO` suffix before API call)
- `getCandles()`: routes `PREDICTION` → `getPolymarketCandles()`
- `getTrending()`: adds `predictions: TrendingAsset[]` to return shape
- `search()`: also calls `searchPredictions()` and merges results

### Changes to `types/index.ts`
- `TrendingAsset.assetType` already accepts the new `PREDICTION` value via the enum
- `getTrending()` return type gains `predictions: TrendingAsset[]`

---

## 3. Trading & Resolution

### Trading
The existing `executeTrade()` in `lib/trading-engine.ts` requires no changes. `assetType: 'PREDICTION'` is passed through; `getQuote()` handles the routing. The `:YES`/`:NO` suffix is part of the symbol string throughout.

### Resolution cron: `/api/cron/resolve-predictions`
Schedule: hourly (added to `vercel.json` cron config).

Algorithm:
1. Find all `Holding` rows with `assetType = 'PREDICTION'`
2. Extract unique `conditionId`s (strip `:YES`/`:NO` suffix)
3. Batch-fetch market status from Polymarket API
4. For each resolved market:
   - YES holdings: create a `SELL` trade at $1.00/share, credit cash, delete holding
   - NO holdings: create a `SELL` trade at $0.00/share, realize full loss, delete holding
5. Log results

### Early exit
Users sell YES/NO tokens at current market price via the normal trade flow. No special handling required.

---

## 4. UI

### Markets page (`app/(dashboard)/markets/page.tsx`)
- Add `'predictions'` to the `Tab` type and `TAB_LABELS`
- Predictions tab fetches from `/api/market/trending` (which now includes `predictions`)
- Category sub-filter: Politics · Crypto · Sports · Business · World (client-side filter on the fetched list)
- Each row: question text, YES% badge, 24h change, volume

### Asset detail / trade modal
- Show full question text
- YES price and NO price side by side ("YES 67¢ · NO 33¢")
- Price chart: YES token history (y-axis 0–1, labelled as probability %)
- "Buy YES" / "Buy NO" buttons pre-fill the trade form with `{conditionId}:YES` or `{conditionId}:NO`

### Portfolio page
- Prediction holdings display question text instead of ticker
- Price shown as probability % rather than dollar amount
- "Resolves [date]" badge on each prediction holding

### No changes needed
Leaderboard, trade history, alerts, screener — all handle `assetType` generically and require no modification.

---

## 5. Error Handling

- Polymarket API failures degrade gracefully: `getTrending()` returns empty `predictions: []`, `getQuote()` throws (same behaviour as other providers)
- Resolution cron: failures on individual markets are logged and skipped; the job does not abort
- Markets that are active on Polymarket but have zero liquidity still show in the browser but trades are blocked at the quote-fetch step if price returns 0

---

## 6. Testing

- Unit tests for `polymarket.ts`: mock CLOB API responses, verify `Quote` mapping and candle construction
- Unit test for resolution logic: mock holdings + resolved market response, verify correct trade records and cash credits
- Existing market-data tests unaffected
