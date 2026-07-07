# Trading Algorithm Bot — Design Spec
**Date:** 2026-03-26
**Project:** Paper Alpha
**Status:** Approved

---

## Overview

A hybrid algorithmic trading bot that holds a real `PaperAccount` in the Paper Alpha database, executes trades internally via the existing trading engine, and appears on the leaderboard with a "BOT" badge. The bot runs daily via a Vercel cron job and uses a multi-strategy approach (momentum + mean reversion) with regime detection to switch between them.

---

## Architecture

### Pipeline

```
/api/cron/bot (hourly Vercel cron)
        │
        ▼
lib/bot/bot-runner.ts       — orchestrates the full pipeline
        │
        ├── universe.ts         — static list of symbols to trade
        ├── market-data.ts      — fetches OHLCV candles (reuses existing providers)
        ├── indicators.ts       — RSI, EMA, ATR, Bollinger Bands
        ├── regime-detector.ts  — classifies TRENDING vs RANGING per asset
        ├── signal-engine.ts    — generates BUY/SELL/HOLD signals per regime
        ├── position-sizer.ts   — half-Kelly Criterion + 5% hard cap
        └── trade-executor.ts   — calls lib/trading-engine.ts directly (no HTTP)
```

### New Files

| Path | Purpose |
|------|---------|
| `lib/bot/universe.ts` | Trading universe definition |
| `lib/bot/market-data.ts` | OHLCV data fetching wrapper |
| `lib/bot/indicators.ts` | Technical indicator calculations |
| `lib/bot/regime-detector.ts` | Market regime classification |
| `lib/bot/signal-engine.ts` | Signal generation per strategy |
| `lib/bot/position-sizer.ts` | Position sizing logic |
| `lib/bot/trade-executor.ts` | Internal trade execution |
| `lib/bot/bot-runner.ts` | Pipeline orchestrator |
| `app/api/cron/bot/route.ts` | Vercel cron endpoint |
| `scripts/seed-bot.ts` | One-time bot account seeder |

### Database Change

Add `isBot: Boolean @default(false)` to the `PaperAccount` model in `prisma/schema.prisma`. Used by the leaderboard UI to render the "BOT" badge.

---

## Trading Universe

**Stocks (via Finnhub):**
AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA, JPM, V, UNH

**Crypto (via CoinGecko):**
BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX

**Commodities via ETFs (via Finnhub, assetType: STOCK):**
GLD (gold), SLV (silver), USO (oil), PDBC (diversified commodities)
Note: These are stock-exchange-listed ETFs and must use `assetType: 'STOCK'` when calling `executeTrade()`. The `COMMODITY` enum in the schema is reserved for potential futures integration.

Total: 22 symbols monitored each cycle.

---

## Signal Engine

### Types

```ts
type Regime = 'TRENDING' | 'RANGING'

type Signal = {
  symbol: string
  action: 'BUY' | 'SELL' | 'HOLD'
  conviction: number   // 0.0–1.0
  strategy: 'MOMENTUM' | 'MEAN_REVERSION'
  regime: Regime
}
```

### Regime Detection

Uses the last 50 daily candles:
- **TRENDING**: 20-period EMA slope > 0.001 (0.1% change per period) AND ATR expanding (current ATR(14) > 20-period ATR SMA)
- **RANGING**: 20-period EMA slope ≤ 0.001 OR ATR contracting

### Momentum Strategy (TRENDING regime)

| Signal | Condition |
|--------|-----------|
| BUY | Price crosses above 20 EMA AND RSI(14) between 50–70 |
| SELL | Price crosses below 20 EMA OR RSI(14) > 80 |
| HOLD | Neither condition met |

Conviction formula (momentum):
```
ema_score    = clamp(ema_slope / 0.005, 0, 1)          // 0.005 = max expected slope
rsi_score    = clamp((rsi - 50) / 30, 0, 1)            // RSI 50→80 maps to 0→1
volume_score = clamp((volume / avg_volume_20 - 1), 0, 1) // 0 if avg, 1 if 2× avg
conviction   = 0.4 * ema_score + 0.4 * rsi_score + 0.2 * volume_score
```

### Mean Reversion Strategy (RANGING regime)

| Signal | Condition |
|--------|-----------|
| BUY | Price ≤ lower Bollinger Band (20, 2σ) AND RSI(14) < 35 |
| SELL | Price ≥ middle Bollinger Band (20 EMA) OR RSI(14) > 65 |
| HOLD | Neither condition met |

Conviction formula (mean reversion):
```
band_score = clamp((lower_band - price) / (middle_band - lower_band), 0, 1)
rsi_score  = clamp((35 - rsi) / 35, 0, 1)   // RSI 35→0 maps to 0→1
conviction = 0.5 * band_score + 0.5 * rsi_score
```

---

## Position Sizing

### Half-Kelly Criterion

```
edge  = estimated win rate (from bot's own trade history, default 0.55)
odds  = average win / average loss (from history, default 1.5)
kelly = (edge * odds - (1 - edge)) / odds
f*    = kelly * 0.5                          // half-Kelly for safety
size  = portfolio_value * f* * conviction
size  = min(size, portfolio_value * 0.05)    // hard cap: 5% per trade
```

All arithmetic uses `Decimal.js` for precision.

### ATR-Based Stop Loss

- Stop = `entry_price - (2 × ATR(14))` for long positions
- Stored in `StopOrder` table (already exists in schema)
- Checked each cron cycle; position closed if breached

---

## Risk Controls

| Rule | Value |
|------|-------|
| Max position size | 5% of portfolio |
| Max crypto allocation | 30% of portfolio |
| Max single-sector allocation | 40% of portfolio |
| Max open positions | 10 |
| Drawdown circuit breaker | If total portfolio drawdown > 15%, stop opening new positions and close all existing ones, resume after 3 cron cycles |

---

## Execution

`trade-executor.ts` calls `executeTrade()` from `lib/trading-engine.ts` directly. Confirmed function signature:

```ts
executeTrade({
  accountId: string,   // bot's PaperAccount ID
  symbol: string,      // e.g. "AAPL", "BTC", "GLD"
  assetType: AssetType, // 'STOCK' | 'CRYPTO' (ETF commodities use 'STOCK')
  side: TradeSide,     // 'BUY' | 'SELL'
  quantity: number,
  note?: string        // e.g. "Bot: MOMENTUM BUY, conviction 0.82"
}): Promise<TradeResult>
```

No HTTP round-trip. Wraps calls in try/catch and logs outcomes. Skips execution if signal is HOLD or position sizing returns zero shares.

---

## Cron Setup

`vercel.json` cron entry (daily at 09:30 UTC — US market open):
```json
{
  "crons": [
    { "path": "/api/cron/bot", "schedule": "30 9 * * *" }
  ]
}
```

**Note:** Daily cron cadence is compatible with Vercel's free/hobby plan. Hourly would require a Pro plan ($20/month).

The endpoint is protected by `CRON_SECRET` header check (same pattern as existing `/api/cron/snapshots`).

---

## Bot Account Setup

`scripts/seed-bot.ts` inserts directly into the DB, bypassing Clerk entirely. The `User.clerkId` field is `@unique` and required, so the bot uses a reserved placeholder value that can never conflict with real Clerk IDs.

Records created:
```
User {
  clerkId:   "bot_algo_alpha_internal",  // placeholder, never a real Clerk ID
  username:  "algo-alpha-bot",
  email:     "bot@paperalpha.internal",
  isBot:     true
}
PaperAccount {
  userId:         <user.id>,
  cashBalance:    100000,
  startingBalance: 100000,
  isBot:          true
}
```

**Schema additions required:**
- `isBot Boolean @default(false)` on `User`
- `isBot Boolean @default(false)` on `PaperAccount`

The bot never authenticates via Clerk — it calls `executeTrade()` directly with its `accountId`, so Clerk middleware is never involved.

Run once via `npx tsx scripts/seed-bot.ts`

---

## Leaderboard UI Change

In the leaderboard component, detect `account.isBot === true` and render a small "BOT" badge next to the username. No other UI changes required.

---

## Testing Approach

- `indicators.ts`: unit tested with known OHLCV sequences and expected output values
- `regime-detector.ts`: unit tested with synthetic trending and ranging price series
- `signal-engine.ts`: unit tested per strategy with mock indicator outputs
- `position-sizer.ts`: unit tested with fixed portfolio values and conviction scores
- `bot-runner.ts`: integration tested against a seeded test account in a local DB

---

## Non-Goals

- No short selling (bot trades long only for simplicity)
- No commodities futures — ETF proxies only
- No intraday HFT — hourly cadence only
- No ML models — pure technical analysis
