# Market Overview Panel — Design Spec

## Goal

Add a "morning briefing" Market Overview panel to the top of the Analysis page, showing the 11 S&P sector performances, major indices, and top movers from the trading universe — giving context before the user drills into individual stocks.

## What's Being Built

A new panel at the top of the Analysis page (`/analysis`) with three sections:

1. **Indices Bar** — slim strip showing S&P 500, Nasdaq, Dow Jones, and Russell 2000 with current price and % change
2. **Sector Heat Map** — colour-coded grid of all 11 S&P sectors showing today's % change (1D only). Green = positive, red = negative. Intensity of colour scales with magnitude.
3. **Top Movers** — top 3 gainers and top 3 losers from the bot's trading universe (41 symbols), sorted by today's % change

The three sections are laid out as: indices strip full-width on top, then sectors (wide, ~65%) and movers (narrow, ~35%) side by side below.

## What's Not Changing

The existing Screener, Earnings Calendar, and Correlation Heatmap remain exactly as they are. The overview is added above them.

## Data Sources

All data fetched via Yahoo Finance (already in use, no new API keys needed).

| Section | Source | How |
|---|---|---|
| Indices | Yahoo Finance quotes | `^GSPC`, `^IXIC`, `^DJI`, `^RUT` via existing `getStockQuote` |
| Sectors | Yahoo Finance quotes | `changePercent` from quotes for 11 SPDR ETFs |
| Top Movers | Yahoo Finance quotes | Quote all 41 universe symbols (stocks only), sort by `changePercent` |

**SPDR ETF tickers for sectors:**

| Sector | Ticker |
|---|---|
| Technology | XLK |
| Financials | XLF |
| Energy | XLE |
| Health Care | XLV |
| Industrials | XLI |
| Consumer Staples | XLP |
| Consumer Discretionary | XLY |
| Real Estate | XLRE |
| Materials | XLB |
| Utilities | XLU |
| Communication Services | XLC |

## API

### `GET /api/market/overview`

Returns a single JSON object. Cached for 5 minutes (`s-maxage=300, stale-while-revalidate=600`).

**Response shape:**

```ts
{
  indices: Array<{
    symbol: string      // e.g. "S&P 500"
    ticker: string      // e.g. "^GSPC"
    price: number
    change: number
    changePercent: number
  }>
  sectors: Array<{
    name: string        // e.g. "Technology"
    ticker: string      // e.g. "XLK"
    changePercent: number  // today's % change
  }>
  movers: {
    gainers: Array<{ symbol: string; changePercent: number; price: number }>
    losers:  Array<{ symbol: string; changePercent: number; price: number }>
  }
}
```

**Error handling:** Each of the three data fetches (indices, sectors, movers) is independent. If one fails the others still return. The route uses `Promise.allSettled` and returns empty arrays for failed sections.

## New Files

### `lib/market-data/overview.ts`

Three exported async functions:

- `getIndices()` — fetches quotes for `^GSPC`, `^IXIC`, `^DJI`, `^RUT` in parallel
- `getSectors()` — fetches quotes for all 11 SPDR ETFs in parallel, returns `name`, `ticker`, and `changePercent` for each
- `getTopMovers()` — fetches quotes for the stock symbols in the universe (from `lib/bot/universe.ts`, excluding crypto), sorts by `changePercent`, returns top 3 gainers and top 3 losers

### `app/api/market/overview/route.ts`

Authenticated Next.js API route. Calls `getIndices`, `getSectors`, `getTopMovers` via `Promise.allSettled`. Returns the combined result with 5-minute cache headers.

### `components/markets/market-overview.tsx`

Client component. Fetches `/api/market/overview` with SWR (60-second revalidate). Renders:
- `IndicesBar` — flex row of index cards
- `SectorHeatmap` — colour-coded grid showing today's % change for each sector
- `TopMovers` — two-column list of gainers (green) and losers (red)

Follows the same pattern as existing market components (loading skeleton, error state, SWR).

## Modified Files

### `app/(dashboard)/analysis/page.tsx`

Import and render `<MarketOverview />` above `<Screener />`.

## Colour Scale for Sector Heat Map

- `> +2%` → full green (`#22c55e`)
- `+0.5% to +2%` → light green (`#86efac`)
- `-0.5% to +0.5%` → neutral (muted text, no background tint)
- `-2% to -0.5%` → light red (`#fca5a5`)
- `< -2%` → full red (`#ef4444`)

## Testing

- Unit test colour assignment logic for sector cells
- Manual: verify all 11 sectors appear, indices match Yahoo Finance values, top movers only show stocks (not crypto)
