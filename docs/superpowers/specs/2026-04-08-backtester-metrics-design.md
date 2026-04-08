# Design: Quant Metrics, Benchmark Comparison & Backtester

**Date:** 2026-04-08  
**Status:** Approved

## Overview

Three additions to paper-alpha to make it a credible quant finance demo:

1. **Extended risk metrics** — Sortino ratio, Calmar ratio, Profit Factor added to the existing Risk Metrics card
2. **Benchmark comparison card** — new portfolio page card showing alpha, beta, correlation, tracking error, information ratio vs SPY/QQQ/BTC
3. **Backtester page** — dedicated `/backtester` route with bot-preset and custom strategy modes, client-side simulation, equity curve, and trade log

---

## Section 1: Extended Risk Metrics

### API changes — `/api/portfolio/metrics/route.ts`

Add three fields to the `RiskMetrics` interface:

```ts
sortino: number | null       // annualised, downside-deviation only
calmar: number | null        // annualisedReturn / |maxDrawdown|
profitFactor: number | null  // grossWins / grossLosses from trade history
```

**Sortino:** Same as Sharpe but standard deviation computed using only negative daily returns (downside deviation). Formula: `(meanDailyReturn - riskFreeDaily) / downsideDeviation * √252`. Returns `null` if fewer than 5 snapshots or downside deviation is 0.

**Calmar:** `annualisedReturn / |maxDrawdown|` where `annualisedReturn = totalReturn / (observedDays / 365)`. Returns `null` if max drawdown is 0.

**Profit Factor:** Load all closed trades (where `realizedPnl != 0`) from `Holding` table. `grossWins / |grossLosses|`. Returns `null` if no losing trades.

### UI changes — `RiskMetricsCard`

- Grid expands from 8 to 11 metric items
- Layout: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`
- Sortino: green ≥ 1, neutral ≥ 0, red < 0
- Calmar: green ≥ 1, neutral ≥ 0.5, red < 0.5
- Profit Factor: green ≥ 1.5, neutral ≥ 1, red < 1

---

## Section 2: Benchmark Comparison Card

### API — `/api/portfolio/benchmark-comparison/route.ts`

Accepts optional `?benchmark=SPY` (default SPY, also supports QQQ, BTC-USD).

1. Load user's `PortfolioSnapshot` records (ordered by date)
2. Fetch benchmark daily closes from Yahoo Finance for the same date range (reuse logic from `/api/market/benchmark`)
3. Align by date string (`YYYY-MM-DD`); skip days where either series has no data (weekends, market holidays, missing snapshots)
4. Compute and return:

```ts
{
  alpha: number              // annualised excess return vs benchmark
  beta: number               // cov(portfolio, benchmark) / var(benchmark)
  correlation: number        // Pearson r between daily return series
  trackingError: number      // annualised std dev of (portfolioReturn - benchmarkReturn)
  informationRatio: number   // (portfolioAnnualised - benchmarkAnnualised) / trackingError
  benchmarkTotalReturn: number  // benchmark return over the period, for context
  dataPoints: number         // number of overlapping daily return pairs
}
```

Requires ≥ 10 overlapping data points; returns `{ error: 'insufficient_data' }` otherwise.

**Formulas:**
- `beta = Σ((rp - rp̄)(rb - rb̄)) / Σ((rb - rb̄)²)`
- `alpha = portfolioAnnualised - beta * benchmarkAnnualised`
- `correlation = cov(rp, rb) / (std(rp) * std(rb))`
- `trackingError = std(rp - rb) * √252 * 100`
- `informationRatio = (portfolioAnnualised - benchmarkAnnualised) / trackingError`

### Component — `BenchmarkComparisonCard`

New file: `components/portfolio/benchmark-comparison.tsx`

- Same card style as `RiskMetricsCard`
- Benchmark selector tabs: SPY | QQQ | BTC-USD (state managed locally, triggers SWR revalidation)
- Metric grid (2 cols mobile, 3 cols sm, 5 cols lg): Alpha, Beta, Correlation, Tracking Error, Info Ratio
- Benchmark return shown as subtitle on the Alpha metric for context
- "Not enough data" state when `dataPoints < 10`

**Placement:** Portfolio page, below `RiskMetricsCard`, above `AchievementsCard`.

---

## Section 3: Backtester Page

### Route

`/app/(dashboard)/backtester/page.tsx` — client component.  
Sidebar entry added between Analysis and Bot Logs.

### Data fetching — `/api/backtest/candles/route.ts`

```
GET /api/backtest/candles?symbol=AAPL&from=2024-01-01&to=2025-01-01&assetType=STOCK
```

Returns daily OHLCV array using:
- Stocks: `getStockCandlesYahoo` from `lib/market-data/yahoo.ts`
- Crypto: `getBinanceCryptoCandles` from `lib/market-data/binance.ts`

Clerk auth required. Max date range: 5 years.

### Simulation engine — `/lib/backtest/engine.ts`

Pure function, no I/O. Inputs: candles + strategy config + starting capital (default $100,000). Outputs `BacktestResult`.

```ts
interface BacktestResult {
  equity: { time: number; value: number }[]
  trades: BacktestTrade[]
  metrics: BacktestMetrics
}

interface BacktestTrade {
  date: string
  action: 'BUY' | 'SELL'
  price: number
  quantity: number
  pnl: number | null   // null on open trades
}

interface BacktestMetrics {
  totalReturn: number
  annualisedReturn: number
  sharpe: number | null
  sortino: number | null
  calmar: number | null
  maxDrawdown: number
  winRate: number | null
  profitFactor: number | null
  totalTrades: number
}
```

**Simulation logic (single asset):**
- Start with `$100,000` cash, 0 shares
- On each candle: evaluate strategy signal → BUY (use `positionSizePct` of portfolio) or SELL (full position)
- Apply stop loss if set: if close < entryPrice * (1 - stopLossPct/100), force SELL
- Record equity curve point after each candle
- Compute metrics from equity curve using same formulas as `/api/portfolio/metrics`

### Strategy types

**Bot preset mode:**
- Runs `generateSignal` from `lib/bot/signal-engine.ts` on the candle series
- `signal-engine.ts` only imports `indicators.ts` and `regime-detector.ts` — both pure math, no server-only APIs, safe for browser execution
- Sentiment score passed as `0` (neutral) — historical sentiment data is not stored, so the live sentiment fetch is skipped
- Weekly candles computed by downsampling daily candles (take the last candle of each calendar week)
- No user-configurable parameters

**Custom strategy mode — parameter editor:**

| Parameter | Type | Default | Range |
|---|---|---|---|
| Indicator | Select | RSI | RSI, EMA Crossover, Bollinger Bands |
| RSI period | Number | 14 | 5–50 |
| RSI buy threshold | Number | 30 | 10–50 |
| RSI sell threshold | Number | 70 | 50–90 |
| EMA fast period | Number | 12 | 5–50 |
| EMA slow period | Number | 26 | 10–200 |
| BB period | Number | 20 | 5–50 |
| BB std dev | Number | 2 | 1–3 |
| Position size | Slider % | 20% | 5–50% |
| Stop loss | Slider % | none | 0–30% (0 = disabled) |

Indicator parameters shown/hidden based on selected indicator.

### UI layout

Two-panel layout:

**Left panel (1/3 width):**
- Symbol input (text field, e.g. "AAPL")
- Asset type toggle: Stock | Crypto
- Date range: from/to date pickers (default: 2 years ago → today)
- Strategy toggle: Bot Preset | Custom
- Custom params section (hidden when Bot Preset selected)
- "Run Backtest" button (disabled while loading)

**Right panel (2/3 width):**
- Empty state until first run
- After run:
  - Equity curve chart (lightweight-charts line series) with optional SPY overlay toggle
  - Metrics grid (same style as RiskMetricsCard) — 3 cols, 9 metrics
  - Trade log table: Date | Action | Price | Quantity | P&L — scrollable, max 10 rows visible

### Sidebar

Add "Backtester" entry to `components/layout/sidebar.tsx` between Analysis and Bot Logs, using the `FlaskConical` icon from lucide-react.

---

## File changes summary

**New files:**
- `app/api/backtest/candles/route.ts`
- `app/api/portfolio/benchmark-comparison/route.ts`
- `app/(dashboard)/backtester/page.tsx`
- `lib/backtest/engine.ts`
- `components/portfolio/benchmark-comparison.tsx`

**Modified files:**
- `app/api/portfolio/metrics/route.ts` — add Sortino, Calmar, Profit Factor
- `components/portfolio/risk-metrics.tsx` — render 3 new metrics
- `app/(dashboard)/portfolio/page.tsx` — add BenchmarkComparisonCard
- `components/layout/sidebar.tsx` — add Backtester nav entry

---

## Out of scope

- Multi-asset portfolio backtesting (single asset only for now)
- Saving/loading backtest configurations
- Comparing multiple strategies side by side
- Intraday resolution (daily candles only)
