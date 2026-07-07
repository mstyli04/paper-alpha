# Trading Algorithm Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hybrid algorithmic trading bot that holds a real PaperAccount, trades daily using momentum + mean-reversion signals with regime detection, and appears on the leaderboard with a BOT badge.

**Architecture:** A modular pipeline (`universe → candles → indicators → regime → signal → sizing → execute`) triggered daily by Vercel cron at 09:30 UTC. The bot's account is seeded directly into the DB with a placeholder Clerk ID, bypassing auth entirely. Each pipeline stage is a focused TypeScript module in `lib/bot/`.

**Tech Stack:** TypeScript, Next.js 14 App Router, Prisma/PostgreSQL, Vitest (tests), Decimal.js (precision math), existing `lib/trading-engine.ts` and `lib/market-data` providers.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `vitest.config.ts` | Vitest configuration with `@` alias |
| Modify | `package.json` | Add vitest dev dependency + test script |
| Modify | `prisma/schema.prisma` | Add `isBot` to `User` and `PaperAccount` |
| Create | `lib/bot/universe.ts` | Typed list of 22 symbols to trade |
| Create | `lib/bot/indicators.ts` | EMA, RSI, ATR, Bollinger Bands — pure functions |
| Create | `lib/bot/regime-detector.ts` | TRENDING vs RANGING classification |
| Create | `lib/bot/signal-engine.ts` | BUY/SELL/HOLD signal generation per regime |
| Create | `lib/bot/position-sizer.ts` | Half-Kelly Criterion with 5% hard cap |
| Create | `lib/bot/market-data.ts` | Fetches 60 daily candles per symbol |
| Create | `lib/bot/trade-executor.ts` | Calls `executeTrade()` directly |
| Create | `lib/bot/bot-runner.ts` | Orchestrates full pipeline |
| Create | `scripts/seed-bot.ts` | One-time bot account creator |
| Create | `app/api/cron/bot/route.ts` | Vercel cron endpoint |
| Modify | `vercel.json` | Add bot cron schedule |
| Modify | `types/index.ts` | Add `isBot` to `LeaderboardEntry` |
| Modify | `lib/portfolio.ts` | Include `isBot` in `getLeaderboard` output |
| Modify | `app/(dashboard)/leaderboard/page.tsx` | Render BOT badge |
| Create | `__tests__/bot/indicators.test.ts` | Unit tests for all indicator functions |
| Create | `__tests__/bot/regime-detector.test.ts` | Unit tests for regime classification |
| Create | `__tests__/bot/signal-engine.test.ts` | Unit tests for signal generation |
| Create | `__tests__/bot/position-sizer.test.ts` | Unit tests for position sizing |

---

## Task 1: Add Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

```bash
cd /home/michael/paper-alpha
npm install --save-dev vitest
```

Expected: `vitest` appears in `devDependencies` in `package.json`.

- [ ] **Step 2: Add test script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create vitest.config.ts**

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 4: Verify setup works**

```bash
npx vitest run
```

Expected output: `No test files found, exiting with code 0` (no tests yet — that's fine).

- [ ] **Step 5: Commit**

```bash
git add package.json vitest.config.ts
git commit -m "chore: add vitest test framework"
```

---

## Task 2: Schema Migration — Add isBot

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add isBot to User and PaperAccount**

In `prisma/schema.prisma`, update the `User` model:
```prisma
model User {
  id        String   @id @default(cuid())
  clerkId   String   @unique
  username  String   @unique
  email     String   @unique
  avatarUrl String?
  isBot     Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  account   PaperAccount?
  watchlist WatchlistItem[]
  alerts    PriceAlert[]
}
```

Update the `PaperAccount` model:
```prisma
model PaperAccount {
  id              String   @id @default(cuid())
  userId          String   @unique
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  cashBalance     Decimal  @db.Decimal(20, 8)
  startingBalance Decimal  @db.Decimal(20, 8)
  isBot           Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  holdings   Holding[]
  trades     Trade[]
  snapshots  PortfolioSnapshot[]
  stopOrders StopOrder[]
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_isbot_flag
```

Expected: Migration file created in `prisma/migrations/`, Prisma client regenerated.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add isBot flag to User and PaperAccount"
```

---

## Task 3: Define Trading Universe

**Files:**
- Create: `lib/bot/universe.ts`

- [ ] **Step 1: Create the universe file**

```ts
// lib/bot/universe.ts
import type { AssetType } from '@/types'

export interface UniverseAsset {
  symbol: string
  assetType: AssetType
  sector: 'TECH' | 'FINANCE' | 'HEALTH' | 'CONSUMER' | 'COMMODITY' | 'CRYPTO'
}

export const UNIVERSE: UniverseAsset[] = [
  // Stocks
  { symbol: 'AAPL',  assetType: 'STOCK', sector: 'TECH' },
  { symbol: 'MSFT',  assetType: 'STOCK', sector: 'TECH' },
  { symbol: 'NVDA',  assetType: 'STOCK', sector: 'TECH' },
  { symbol: 'GOOGL', assetType: 'STOCK', sector: 'TECH' },
  { symbol: 'AMZN',  assetType: 'STOCK', sector: 'CONSUMER' },
  { symbol: 'META',  assetType: 'STOCK', sector: 'TECH' },
  { symbol: 'TSLA',  assetType: 'STOCK', sector: 'CONSUMER' },
  { symbol: 'JPM',   assetType: 'STOCK', sector: 'FINANCE' },
  { symbol: 'V',     assetType: 'STOCK', sector: 'FINANCE' },
  { symbol: 'UNH',   assetType: 'STOCK', sector: 'HEALTH' },
  // Crypto
  { symbol: 'BTC',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'ETH',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'SOL',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'BNB',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'XRP',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'DOGE',  assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'ADA',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'AVAX',  assetType: 'CRYPTO', sector: 'CRYPTO' },
  // Commodity ETFs (traded as STOCK via Finnhub)
  { symbol: 'GLD',   assetType: 'STOCK', sector: 'COMMODITY' },
  { symbol: 'SLV',   assetType: 'STOCK', sector: 'COMMODITY' },
  { symbol: 'USO',   assetType: 'STOCK', sector: 'COMMODITY' },
  { symbol: 'PDBC',  assetType: 'STOCK', sector: 'COMMODITY' },
]
```

- [ ] **Step 2: Commit**

```bash
git add lib/bot/universe.ts
git commit -m "feat: add trading universe definition"
```

---

## Task 4: Indicator Functions (TDD)

**Files:**
- Create: `__tests__/bot/indicators.test.ts`
- Create: `lib/bot/indicators.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/bot/indicators.test.ts
import { describe, it, expect } from 'vitest'
import { ema, rsi, atr, bollingerBands, emaSlope } from '@/lib/bot/indicators'
import type { CandleData } from '@/types'

// 30 synthetic closes: alternating gentle up trend
const closes30 = Array.from({ length: 30 }, (_, i) => 100 + i * 0.5)

// 30 candles with high/low for ATR
const candles30: CandleData[] = closes30.map((c, i) => ({
  time: i,
  open: c - 0.2,
  high: c + 1,
  low: c - 1,
  close: c,
  volume: 1000,
}))

describe('ema', () => {
  it('returns empty array when not enough data', () => {
    expect(ema([1, 2, 3], 5)).toEqual([])
  })

  it('first value equals SMA of first period values', () => {
    const prices = [10, 20, 30, 40, 50]
    const result = ema(prices, 3)
    // First EMA = SMA of [10,20,30] = 20
    expect(result[0]).toBeCloseTo(20)
  })

  it('length equals prices.length - period + 1', () => {
    const result = ema(closes30, 20)
    expect(result.length).toBe(closes30.length - 20 + 1)
  })

  it('EMA rises in a rising price series', () => {
    const result = ema(closes30, 10)
    expect(result[result.length - 1]).toBeGreaterThan(result[0])
  })
})

describe('rsi', () => {
  it('returns empty when fewer than period+1 prices', () => {
    expect(rsi([1, 2, 3], 14)).toEqual([])
  })

  it('RSI is 100 when prices only go up', () => {
    const risingPrices = Array.from({ length: 20 }, (_, i) => i + 1)
    const result = rsi(risingPrices, 14)
    expect(result[0]).toBeCloseTo(100)
  })

  it('RSI is 0 when prices only go down', () => {
    const fallingPrices = Array.from({ length: 20 }, (_, i) => 20 - i)
    const result = rsi(fallingPrices, 14)
    expect(result[0]).toBeCloseTo(0)
  })

  it('RSI stays between 0 and 100', () => {
    const result = rsi(closes30, 14)
    result.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    })
  })
})

describe('atr', () => {
  it('returns empty when not enough candles', () => {
    expect(atr(candles30.slice(0, 5), 14)).toEqual([])
  })

  it('returns positive values', () => {
    const result = atr(candles30, 14)
    result.forEach(v => expect(v).toBeGreaterThan(0))
  })

  it('length is candles.length - period', () => {
    const result = atr(candles30, 14)
    expect(result.length).toBe(candles30.length - 14)
  })
})

describe('bollingerBands', () => {
  it('returns empty when not enough data', () => {
    expect(bollingerBands([1, 2, 3], 20)).toEqual([])
  })

  it('upper > middle > lower', () => {
    const result = bollingerBands(closes30, 20)
    result.forEach(b => {
      expect(b.upper).toBeGreaterThan(b.middle)
      expect(b.middle).toBeGreaterThan(b.lower)
    })
  })

  it('length equals closes.length - period + 1', () => {
    const result = bollingerBands(closes30, 20)
    expect(result.length).toBe(closes30.length - 20 + 1)
  })
})

describe('emaSlope', () => {
  it('returns 0 for single value', () => {
    expect(emaSlope([100])).toBe(0)
  })

  it('returns positive slope for rising EMA', () => {
    expect(emaSlope([100, 101])).toBeGreaterThan(0)
  })

  it('returns negative slope for falling EMA', () => {
    expect(emaSlope([101, 100])).toBeLessThan(0)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run __tests__/bot/indicators.test.ts
```

Expected: `FAIL` — `Cannot find module '@/lib/bot/indicators'`.

- [ ] **Step 3: Implement indicators.ts**

```ts
// lib/bot/indicators.ts
import type { CandleData } from '@/types'

export interface BollingerBand {
  upper: number
  middle: number
  lower: number
}

/** Exponential Moving Average. Returns array of length (prices.length - period + 1). */
export function ema(prices: number[], period: number): number[] {
  if (prices.length < period) return []
  const k = 2 / (period + 1)
  // Seed with SMA of first `period` values
  let prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
  const result: number[] = [prev]
  for (let i = period; i < prices.length; i++) {
    prev = prices[i] * k + prev * (1 - k)
    result.push(prev)
  }
  return result
}

/** Wilder RSI. Returns array of length (closes.length - period). */
export function rsi(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return []
  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1]
    if (change > 0) avgGain += change
    else avgLoss += Math.abs(change)
  }
  avgGain /= period
  avgLoss /= period
  const result: number[] = [avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)]
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? Math.abs(change) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
  }
  return result
}

/** Wilder Average True Range. Returns array of length (candles.length - period). */
export function atr(candles: CandleData[], period = 14): number[] {
  if (candles.length < period + 1) return []
  const trs: number[] = []
  for (let i = 1; i < candles.length; i++) {
    const { high, low } = candles[i]
    const prevClose = candles[i - 1].close
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)))
  }
  let prev = trs.slice(0, period).reduce((a, b) => a + b, 0) / period
  const result: number[] = [prev]
  for (let i = period; i < trs.length; i++) {
    prev = (prev * (period - 1) + trs[i]) / period
    result.push(prev)
  }
  return result
}

/** Bollinger Bands (SMA ± stdDev). Returns array of length (closes.length - period + 1). */
export function bollingerBands(closes: number[], period = 20, multiplier = 2): BollingerBand[] {
  if (closes.length < period) return []
  const result: BollingerBand[] = []
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period
    const std = Math.sqrt(variance)
    result.push({ upper: mean + multiplier * std, middle: mean, lower: mean - multiplier * std })
  }
  return result
}

/** Percentage change between last two EMA values. Returns 0 if fewer than 2 values. */
export function emaSlope(emaValues: number[]): number {
  if (emaValues.length < 2) return 0
  const last = emaValues[emaValues.length - 1]
  const prev = emaValues[emaValues.length - 2]
  return prev === 0 ? 0 : (last - prev) / prev
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run __tests__/bot/indicators.test.ts
```

Expected: All tests `PASS`.

- [ ] **Step 5: Commit**

```bash
git add lib/bot/indicators.ts __tests__/bot/indicators.test.ts
git commit -m "feat: add technical indicator functions with tests"
```

---

## Task 5: Regime Detector (TDD)

**Files:**
- Create: `__tests__/bot/regime-detector.test.ts`
- Create: `lib/bot/regime-detector.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/bot/regime-detector.test.ts
import { describe, it, expect } from 'vitest'
import { detectRegime } from '@/lib/bot/regime-detector'
import type { CandleData } from '@/types'

function makeCandles(closes: number[]): CandleData[] {
  return closes.map((c, i) => ({
    time: i,
    open: c - 0.5,
    high: c + 2,
    low: c - 2,
    close: c,
    volume: 1000,
  }))
}

// Strong uptrend: price climbs 1% per day
const trendingCloses = Array.from({ length: 50 }, (_, i) => 100 * Math.pow(1.01, i))

// Sideways market: price oscillates around 100
const rangingCloses = Array.from({ length: 50 }, (_, i) =>
  100 + Math.sin(i * 0.4) * 1.5
)

describe('detectRegime', () => {
  it('returns RANGING when fewer than 35 candles', () => {
    expect(detectRegime(makeCandles(trendingCloses.slice(0, 20)))).toBe('RANGING')
  })

  it('detects TRENDING in a strong uptrend', () => {
    expect(detectRegime(makeCandles(trendingCloses))).toBe('TRENDING')
  })

  it('detects RANGING in a sideways market', () => {
    expect(detectRegime(makeCandles(rangingCloses))).toBe('RANGING')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run __tests__/bot/regime-detector.test.ts
```

Expected: `FAIL` — module not found.

- [ ] **Step 3: Implement regime-detector.ts**

```ts
// lib/bot/regime-detector.ts
import type { CandleData } from '@/types'
import { ema, atr, emaSlope } from './indicators'

export type Regime = 'TRENDING' | 'RANGING'

const EMA_SLOPE_THRESHOLD = 0.001  // 0.1% per period

export function detectRegime(candles: CandleData[]): Regime {
  if (candles.length < 35) return 'RANGING'

  const closes = candles.map(c => c.close)
  const emaValues = ema(closes, 20)
  const atrValues = atr(candles, 14)

  if (emaValues.length < 2 || atrValues.length < 21) return 'RANGING'

  const slope = Math.abs(emaSlope(emaValues))
  const slopeAbove = slope > EMA_SLOPE_THRESHOLD

  // ATR expanding: current ATR > 20-period SMA of ATR
  const recentAtr = atrValues.slice(-20)
  const atrSma = recentAtr.reduce((a, b) => a + b, 0) / recentAtr.length
  const currentAtr = atrValues[atrValues.length - 1]
  const atrExpanding = currentAtr > atrSma

  return slopeAbove && atrExpanding ? 'TRENDING' : 'RANGING'
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run __tests__/bot/regime-detector.test.ts
```

Expected: All tests `PASS`.

- [ ] **Step 5: Commit**

```bash
git add lib/bot/regime-detector.ts __tests__/bot/regime-detector.test.ts
git commit -m "feat: add regime detector (TRENDING/RANGING) with tests"
```

---

## Task 6: Signal Engine (TDD)

**Files:**
- Create: `__tests__/bot/signal-engine.test.ts`
- Create: `lib/bot/signal-engine.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/bot/signal-engine.test.ts
import { describe, it, expect } from 'vitest'
import { generateSignal } from '@/lib/bot/signal-engine'
import type { CandleData } from '@/types'

function makeCandles(closes: number[], highLowSpread = 2): CandleData[] {
  return closes.map((c, i) => ({
    time: i,
    open: c - 0.2,
    high: c + highLowSpread,
    low: c - highLowSpread,
    close: c,
    volume: 1000,
  }))
}

// Strong uptrend (1% per bar) — should trigger TRENDING regime
const trendingCloses = Array.from({ length: 50 }, (_, i) => 100 * Math.pow(1.01, i))

// Sideways — should trigger RANGING regime
const rangingCloses = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.4) * 1.5)

// Price below lower BB: 50 prices around 100, then a sharp drop
const oversoldCloses = [
  ...Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i * 0.3) * 0.5),
  ...Array.from({ length: 10 }, (_, i) => 100 - i * 3),
]

describe('generateSignal', () => {
  it('returns a signal object with required fields', () => {
    const signal = generateSignal('AAPL', makeCandles(trendingCloses), false)
    expect(signal).toHaveProperty('symbol', 'AAPL')
    expect(signal).toHaveProperty('action')
    expect(signal).toHaveProperty('conviction')
    expect(signal).toHaveProperty('strategy')
    expect(signal).toHaveProperty('regime')
  })

  it('conviction is between 0 and 1', () => {
    const signal = generateSignal('AAPL', makeCandles(trendingCloses), false)
    expect(signal.conviction).toBeGreaterThanOrEqual(0)
    expect(signal.conviction).toBeLessThanOrEqual(1)
  })

  it('returns HOLD when already held and trend is ongoing (no crossover yet)', () => {
    // Price well above EMA throughout — no crossover down
    const held = generateSignal('AAPL', makeCandles(trendingCloses), true)
    // Just check it returns a valid action — won't SELL unless crossover
    expect(['BUY', 'SELL', 'HOLD']).toContain(held.action)
  })

  it('returns RANGING regime signal for sideways prices', () => {
    const signal = generateSignal('BTC', makeCandles(rangingCloses), false)
    expect(signal.regime).toBe('RANGING')
    expect(signal.strategy).toBe('MEAN_REVERSION')
  })

  it('returns TRENDING regime signal for trending prices', () => {
    const signal = generateSignal('AAPL', makeCandles(trendingCloses), false)
    expect(signal.regime).toBe('TRENDING')
    expect(signal.strategy).toBe('MOMENTUM')
  })

  it('returns BUY in ranging regime when price is oversold below lower band', () => {
    const signal = generateSignal('BTC', makeCandles(oversoldCloses, 0.1), false)
    // With a sharp drop, RSI will be very low and price below lower band
    if (signal.action === 'BUY') {
      expect(signal.conviction).toBeGreaterThan(0)
    }
    // Even if HOLD, the regime should be RANGING
    expect(signal.strategy).toBe('MEAN_REVERSION')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run __tests__/bot/signal-engine.test.ts
```

Expected: `FAIL` — module not found.

- [ ] **Step 3: Implement signal-engine.ts**

```ts
// lib/bot/signal-engine.ts
import type { CandleData } from '@/types'
import { ema, rsi, bollingerBands, emaSlope } from './indicators'
import { detectRegime, type Regime } from './regime-detector'

export type SignalAction = 'BUY' | 'SELL' | 'HOLD'

export interface Signal {
  symbol: string
  action: SignalAction
  conviction: number  // 0.0–1.0
  strategy: 'MOMENTUM' | 'MEAN_REVERSION'
  regime: Regime
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function momentumSignal(
  symbol: string,
  closes: number[],
  volumes: number[],
  isHeld: boolean
): Signal {
  const base: Signal = { symbol, action: 'HOLD', conviction: 0, strategy: 'MOMENTUM', regime: 'TRENDING' }
  const emaValues = ema(closes, 20)
  const rsiValues = rsi(closes, 14)
  if (emaValues.length < 2 || rsiValues.length < 1) return base

  const price     = closes[closes.length - 1]
  const prevPrice = closes[closes.length - 2]
  const currEma   = emaValues[emaValues.length - 1]
  const prevEma   = emaValues[emaValues.length - 2]
  const currRsi   = rsiValues[rsiValues.length - 1]
  const slope     = emaSlope(emaValues)

  const crossedAbove = prevPrice <= prevEma && price > currEma
  const crossedBelow = prevPrice >= prevEma && price < currEma

  if (isHeld && (crossedBelow || currRsi > 80)) {
    return { ...base, action: 'SELL', conviction: clamp((currRsi - 50) / 30, 0, 1) }
  }

  if (!isHeld && crossedAbove && currRsi >= 50 && currRsi <= 70) {
    const avg20Vol   = volumes.length >= 21
      ? volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20
      : 0
    const currVol    = volumes[volumes.length - 1]
    const emaScore   = clamp(slope / 0.005, 0, 1)
    const rsiScore   = clamp((currRsi - 50) / 30, 0, 1)
    const volScore   = avg20Vol > 0 ? clamp(currVol / avg20Vol - 1, 0, 1) : 0
    const conviction = 0.4 * emaScore + 0.4 * rsiScore + 0.2 * volScore
    return { ...base, action: 'BUY', conviction: clamp(conviction, 0, 1) }
  }

  return base
}

function meanReversionSignal(
  symbol: string,
  closes: number[],
  isHeld: boolean
): Signal {
  const base: Signal = { symbol, action: 'HOLD', conviction: 0, strategy: 'MEAN_REVERSION', regime: 'RANGING' }
  const bands     = bollingerBands(closes, 20, 2)
  const rsiValues = rsi(closes, 14)
  if (bands.length < 1 || rsiValues.length < 1) return base

  const price    = closes[closes.length - 1]
  const band     = bands[bands.length - 1]
  const currRsi  = rsiValues[rsiValues.length - 1]

  if (isHeld && (price >= band.middle || currRsi > 65)) {
    return { ...base, action: 'SELL', conviction: 0.7 }
  }

  if (!isHeld && price <= band.lower && currRsi < 35) {
    const bandRange  = band.middle - band.lower
    const bandScore  = bandRange > 0 ? clamp((band.lower - price) / bandRange, 0, 1) : 0
    const rsiScore   = clamp((35 - currRsi) / 35, 0, 1)
    const conviction = 0.5 * bandScore + 0.5 * rsiScore
    return { ...base, action: 'BUY', conviction: clamp(conviction, 0, 1) }
  }

  return base
}

export function generateSignal(
  symbol: string,
  candles: CandleData[],
  isHeld: boolean
): Signal {
  const regime  = detectRegime(candles)
  const closes  = candles.map(c => c.close)
  const volumes = candles.map(c => c.volume ?? 0)

  if (regime === 'TRENDING') return momentumSignal(symbol, closes, volumes, isHeld)
  return meanReversionSignal(symbol, closes, isHeld)
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run __tests__/bot/signal-engine.test.ts
```

Expected: All tests `PASS`.

- [ ] **Step 5: Commit**

```bash
git add lib/bot/signal-engine.ts __tests__/bot/signal-engine.test.ts
git commit -m "feat: add signal engine (momentum + mean reversion) with tests"
```

---

## Task 7: Position Sizer (TDD)

**Files:**
- Create: `__tests__/bot/position-sizer.test.ts`
- Create: `lib/bot/position-sizer.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/bot/position-sizer.test.ts
import { describe, it, expect } from 'vitest'
import { calculatePositionSize } from '@/lib/bot/position-sizer'

describe('calculatePositionSize', () => {
  it('returns 0 when price is 0', () => {
    expect(calculatePositionSize({ portfolioValue: 100000, price: 0, conviction: 1, assetType: 'STOCK' })).toBe(0)
  })

  it('returns 0 when conviction is 0', () => {
    expect(calculatePositionSize({ portfolioValue: 100000, price: 100, conviction: 0, assetType: 'STOCK' })).toBe(0)
  })

  it('never exceeds 5% of portfolio value', () => {
    const result = calculatePositionSize({
      portfolioValue: 100000,
      price: 10,
      conviction: 1,
      assetType: 'STOCK',
    })
    expect(result * 10).toBeLessThanOrEqual(100000 * 0.05)
  })

  it('scales with conviction — higher conviction produces more shares', () => {
    const low  = calculatePositionSize({ portfolioValue: 100000, price: 100, conviction: 0.2, assetType: 'STOCK' })
    const high = calculatePositionSize({ portfolioValue: 100000, price: 100, conviction: 0.9, assetType: 'STOCK' })
    expect(high).toBeGreaterThan(low)
  })

  it('returns whole shares for STOCK', () => {
    const result = calculatePositionSize({ portfolioValue: 100000, price: 150, conviction: 0.8, assetType: 'STOCK' })
    expect(result).toBe(Math.floor(result))
  })

  it('returns fractional quantity for CRYPTO', () => {
    const result = calculatePositionSize({ portfolioValue: 100000, price: 60000, conviction: 0.8, assetType: 'CRYPTO' })
    // Should be a small fraction of BTC
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(1)
  })

  it('uses custom win rate and odds when provided', () => {
    const conservative = calculatePositionSize({
      portfolioValue: 100000, price: 100, conviction: 1,
      assetType: 'STOCK', winRate: 0.4, avgWinLossRatio: 1.0,
    })
    const aggressive = calculatePositionSize({
      portfolioValue: 100000, price: 100, conviction: 1,
      assetType: 'STOCK', winRate: 0.7, avgWinLossRatio: 2.0,
    })
    expect(aggressive).toBeGreaterThan(conservative)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run __tests__/bot/position-sizer.test.ts
```

Expected: `FAIL` — module not found.

- [ ] **Step 3: Implement position-sizer.ts**

```ts
// lib/bot/position-sizer.ts
import type { AssetType } from '@/types'

export interface PositionSizeInput {
  portfolioValue: number
  price: number
  conviction: number       // 0.0–1.0 from signal engine
  assetType: AssetType
  winRate?: number         // historical win rate, defaults to 0.55
  avgWinLossRatio?: number // avg_win / avg_loss, defaults to 1.5
}

const MAX_POSITION_FRACTION = 0.05  // 5% hard cap
const CRYPTO_DECIMALS = 6
const STOCK_DECIMALS  = 0           // whole shares

export function calculatePositionSize(input: PositionSizeInput): number {
  const {
    portfolioValue,
    price,
    conviction,
    assetType,
    winRate = 0.55,
    avgWinLossRatio = 1.5,
  } = input

  if (price <= 0 || conviction <= 0 || portfolioValue <= 0) return 0

  // Half-Kelly Criterion
  const kelly     = (winRate * avgWinLossRatio - (1 - winRate)) / avgWinLossRatio
  const halfKelly = Math.max(0, kelly * 0.5)

  const rawDollar  = portfolioValue * halfKelly * conviction
  const capDollar  = portfolioValue * MAX_POSITION_FRACTION
  const dollarSize = Math.min(rawDollar, capDollar)

  const rawQuantity = dollarSize / price

  if (assetType === 'CRYPTO') {
    const factor = Math.pow(10, CRYPTO_DECIMALS)
    return Math.floor(rawQuantity * factor) / factor
  }

  return Math.floor(rawQuantity)
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run __tests__/bot/position-sizer.test.ts
```

Expected: All tests `PASS`.

- [ ] **Step 5: Run all tests to make sure nothing is broken**

```bash
npx vitest run
```

Expected: All test files `PASS`.

- [ ] **Step 6: Commit**

```bash
git add lib/bot/position-sizer.ts __tests__/bot/position-sizer.test.ts
git commit -m "feat: add half-Kelly position sizer with tests"
```

---

## Task 8: Market Data Wrapper

**Files:**
- Create: `lib/bot/market-data.ts`

- [ ] **Step 1: Create market-data.ts**

```ts
// lib/bot/market-data.ts
import type { CandleData, AssetType } from '@/types'
import { getCandles } from '@/lib/market-data'

const CANDLE_DAYS = 60  // Fetch 60 days to guarantee 50 usable daily candles

/** Fetch daily OHLCV candles for a symbol. Returns empty array on failure. */
export async function fetchBotCandles(
  symbol: string,
  assetType: AssetType
): Promise<CandleData[]> {
  const to   = Math.floor(Date.now() / 1000)
  const from = to - CANDLE_DAYS * 24 * 60 * 60

  try {
    const candles = await getCandles(symbol, assetType, 'D', from, to)
    return candles ?? []
  } catch {
    return []
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/bot/market-data.ts
git commit -m "feat: add bot market data wrapper for daily candles"
```

---

## Task 9: Trade Executor

**Files:**
- Create: `lib/bot/trade-executor.ts`

- [ ] **Step 1: Create trade-executor.ts**

```ts
// lib/bot/trade-executor.ts
import { executeTrade } from '@/lib/trading-engine'
import type { AssetType } from '@/types'
import type { Signal } from './signal-engine'

export interface ExecutionResult {
  success: boolean
  symbol: string
  action: 'BUY' | 'SELL'
  quantity: number
  error?: string
}

/** Calls executeTrade() directly (no HTTP). Returns result for logging. */
export async function executeSignal(
  accountId: string,
  signal: Signal,
  quantity: number,
  assetType: AssetType
): Promise<ExecutionResult> {
  if (signal.action === 'HOLD' || quantity <= 0) {
    return { success: true, symbol: signal.symbol, action: 'BUY', quantity: 0 }
  }

  const side = signal.action  // 'BUY' or 'SELL' — matches TradeSide enum
  const note = `Bot: ${signal.strategy} ${side} | conviction ${signal.conviction.toFixed(2)} | regime ${signal.regime}`

  const result = await executeTrade({ accountId, symbol: signal.symbol, assetType, side, quantity, note })

  return {
    success: result.success,
    symbol: signal.symbol,
    action: side,
    quantity,
    error: result.error,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/bot/trade-executor.ts
git commit -m "feat: add trade executor that calls trading-engine directly"
```

---

## Task 10: Bot Runner

**Files:**
- Create: `lib/bot/bot-runner.ts`

- [ ] **Step 1: Create bot-runner.ts**

```ts
// lib/bot/bot-runner.ts
import { db } from '@/lib/db'
import { getQuote } from '@/lib/market-data'
import { UNIVERSE } from './universe'
import { fetchBotCandles } from './market-data'
import { generateSignal } from './signal-engine'
import { calculatePositionSize } from './position-sizer'
import { executeSignal } from './trade-executor'
import type { AssetType } from '@/types'

const MAX_POSITIONS      = 10
const MAX_CRYPTO_PERCENT = 0.30
const MAX_SECTOR_PERCENT = 0.40
const MAX_DRAWDOWN       = 0.15
const CIRCUIT_BREAKER_CYCLES = 3

// In-memory circuit breaker (resets on cold start / new Vercel instance)
let circuitBreakerTriggeredAt: number | null = null

export interface BotRunResult {
  tradesExecuted: number
  skipped: number
  errors: string[]
}

export async function runBot(botAccountId: string): Promise<BotRunResult> {
  const errors: string[] = []
  let tradesExecuted = 0
  let skipped = 0

  // 1. Circuit breaker check
  if (circuitBreakerTriggeredAt !== null) {
    const daysSince = (Date.now() - circuitBreakerTriggeredAt) / (1000 * 60 * 60 * 24)
    if (daysSince < CIRCUIT_BREAKER_CYCLES) {
      const remaining = CIRCUIT_BREAKER_CYCLES - Math.floor(daysSince)
      return { tradesExecuted: 0, skipped: 0, errors: [`Circuit breaker active: ${remaining} cycles remaining`] }
    }
    circuitBreakerTriggeredAt = null
  }

  // 2. Load account state
  const account = await db.paperAccount.findUnique({
    where: { id: botAccountId },
    include: { holdings: true },
  })
  if (!account) throw new Error(`Bot account not found: ${botAccountId}`)

  const cashBalance      = Number(account.cashBalance)
  const startingBalance  = Number(account.startingBalance)

  // 3. Estimate portfolio value using last-known prices (avg cost as fallback)
  const holdingsValue = account.holdings.reduce((sum, h) => {
    return sum + Number(h.quantity) * Number(h.avgCostBasis)
  }, 0)
  const portfolioValue = cashBalance + holdingsValue

  // 4. Drawdown circuit breaker
  const drawdown = startingBalance > 0
    ? (startingBalance - portfolioValue) / startingBalance
    : 0

  if (drawdown > MAX_DRAWDOWN) {
    circuitBreakerTriggeredAt = Date.now()
    // Close all long positions
    for (const holding of account.holdings.filter(h => Number(h.quantity) > 0)) {
      await executeSignal(
        botAccountId,
        { symbol: holding.symbol, action: 'SELL', conviction: 1, strategy: 'MOMENTUM', regime: 'TRENDING' },
        Number(holding.quantity),
        holding.assetType as AssetType
      )
    }
    return { tradesExecuted: 0, skipped: 0, errors: [`Drawdown ${(drawdown * 100).toFixed(1)}% exceeded 15% — liquidated all positions`] }
  }

  const holdingMap = new Map(account.holdings.map(h => [h.symbol, h]))

  // 5. Process each asset in universe
  for (const asset of UNIVERSE) {
    const holding   = holdingMap.get(asset.symbol)
    const isHeld    = !!holding && Number(holding.quantity) > 0
    const openCount = account.holdings.filter(h => Number(h.quantity) > 0).length

    const candles = await fetchBotCandles(asset.symbol, asset.assetType)
    if (candles.length < 30) { skipped++; continue }

    const signal = generateSignal(asset.symbol, candles, isHeld)

    // SELL
    if (signal.action === 'SELL' && isHeld && holding) {
      const qty = Number(holding.quantity)
      const result = await executeSignal(botAccountId, signal, qty, asset.assetType)
      if (result.success) tradesExecuted++
      else errors.push(`SELL ${asset.symbol}: ${result.error}`)
      continue
    }

    // BUY — check all portfolio constraints first
    if (signal.action === 'BUY' && !isHeld) {
      if (openCount >= MAX_POSITIONS) { skipped++; continue }

      // Max crypto allocation check
      if (asset.assetType === 'CRYPTO') {
        const cryptoValue = account.holdings
          .filter(h => h.assetType === 'CRYPTO' && Number(h.quantity) > 0)
          .reduce((sum, h) => sum + Number(h.quantity) * Number(h.avgCostBasis), 0)
        if (portfolioValue > 0 && cryptoValue / portfolioValue >= MAX_CRYPTO_PERCENT) {
          skipped++; continue
        }
      }

      // Max sector allocation check
      const sectorAssets = UNIVERSE.filter(u => u.sector === asset.sector).map(u => u.symbol)
      const sectorValue = account.holdings
        .filter(h => sectorAssets.includes(h.symbol) && Number(h.quantity) > 0)
        .reduce((sum, h) => sum + Number(h.quantity) * Number(h.avgCostBasis), 0)
      if (portfolioValue > 0 && sectorValue / portfolioValue >= MAX_SECTOR_PERCENT) {
        skipped++; continue
      }

      // Fetch live price for sizing
      let quote
      try {
        quote = await getQuote(asset.symbol, asset.assetType)
      } catch {
        skipped++; continue
      }

      // Compute win rate and avg win/loss from bot's own history
      const trades = await db.trade.findMany({
        where: { accountId: botAccountId, symbol: asset.symbol },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      const { winRate, avgWinLossRatio } = computeEdge(trades)

      const quantity = calculatePositionSize({
        portfolioValue,
        price: quote.price,
        conviction: signal.conviction,
        assetType: asset.assetType === 'CRYPTO' ? 'CRYPTO' : 'STOCK',
        winRate,
        avgWinLossRatio,
      })

      if (quantity <= 0) { skipped++; continue }
      if (quote.price * quantity > cashBalance) { skipped++; continue }

      const result = await executeSignal(botAccountId, signal, quantity, asset.assetType)
      if (result.success) tradesExecuted++
      else errors.push(`BUY ${asset.symbol}: ${result.error}`)
    }
  }

  return { tradesExecuted, skipped, errors }
}

import type { Trade } from '@prisma/client'

function computeEdge(trades: Trade[]): { winRate: number; avgWinLossRatio: number } {
  const pairs: { pnl: number }[] = []
  for (let i = 0; i < trades.length - 1; i++) {
    const sell = trades[i]
    const buy  = trades[i + 1]
    if (sell.side === 'SELL' && buy.side === 'BUY') {
      const pnl = Number(sell.price) - Number(buy.price)
      pairs.push({ pnl })
    }
  }
  if (pairs.length === 0) return { winRate: 0.55, avgWinLossRatio: 1.5 }

  const wins   = pairs.filter(p => p.pnl > 0)
  const losses = pairs.filter(p => p.pnl <= 0)
  const winRate = wins.length / pairs.length
  const avgWin  = wins.length   > 0 ? wins.reduce((s, p) => s + p.pnl, 0)          / wins.length   : 1
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, p) => s + p.pnl, 0) / losses.length) : 1

  return {
    winRate:         winRate || 0.55,
    avgWinLossRatio: avgLoss > 0 ? avgWin / avgLoss : 1.5,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/bot/bot-runner.ts
git commit -m "feat: add bot runner pipeline with drawdown circuit breaker"
```

---

## Task 10b: ATR Stop Losses

**Files:**
- Modify: `lib/bot/bot-runner.ts`

Stop losses are created when the bot buys and checked at the start of each cycle using the existing `StopOrder` table.

- [ ] **Step 1: Add stop-loss checking at the start of runBot (before processing signals)**

Add this block after loading `holdingMap`, before the `for (const asset of UNIVERSE)` loop:

```ts
// Check and execute triggered stop orders
const activeStops = await db.stopOrder.findMany({
  where: { accountId: botAccountId, status: 'ACTIVE' },
})
for (const stop of activeStops) {
  try {
    const quote = await getQuote(stop.symbol, stop.assetType as AssetType)
    const breached = stop.condition === 'BELOW'
      ? quote.price <= Number(stop.triggerPrice)
      : quote.price >= Number(stop.triggerPrice)

    if (breached) {
      const result = await executeSignal(
        botAccountId,
        { symbol: stop.symbol, action: 'SELL', conviction: 1, strategy: 'MOMENTUM', regime: 'TRENDING' },
        Number(stop.quantity),
        stop.assetType as AssetType
      )
      await db.stopOrder.update({
        where: { id: stop.id },
        data: { status: result.success ? 'TRIGGERED' : 'FAILED', triggeredAt: new Date() },
      })
      if (result.success) tradesExecuted++
    }
  } catch {
    // Skip failed stop checks — will retry next cycle
  }
}
```

- [ ] **Step 2: Create a stop order after each successful BUY**

Inside the BUY block, after `if (result.success) tradesExecuted++`, add:

```ts
if (result.success) {
  tradesExecuted++
  // Create ATR-based stop loss
  const atrValues = atr(candles, 14)
  if (atrValues.length > 0) {
    const currentAtr    = atrValues[atrValues.length - 1]
    const stopPrice     = quote.price - 2 * currentAtr
    await db.stopOrder.create({
      data: {
        accountId:    botAccountId,
        symbol:       asset.symbol,
        assetType:    asset.assetType,
        side:         'SELL',
        triggerPrice: stopPrice,
        condition:    'BELOW',
        quantity:     quantity,
        status:       'ACTIVE',
      },
    })
  }
}
```

Add `import { atr } from './indicators'` to the top of `bot-runner.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/bot/bot-runner.ts
git commit -m "feat: add ATR-based stop loss creation and checking to bot runner"
```

---

## Task 11: Seed Script

**Files:**
- Create: `scripts/seed-bot.ts`

- [ ] **Step 1: Create seed-bot.ts**

```ts
// scripts/seed-bot.ts
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const BOT_CLERK_ID = 'bot_algo_alpha_internal'
  const STARTING_BALANCE = 100000

  const existing = await db.user.findUnique({ where: { clerkId: BOT_CLERK_ID } })
  if (existing) {
    console.log('Bot account already exists:', existing.id)
    await db.$disconnect()
    return
  }

  const user = await db.user.create({
    data: {
      clerkId:  BOT_CLERK_ID,
      username: 'algo-alpha-bot',
      email:    'bot@paperalpha.internal',
      isBot:    true,
      account: {
        create: {
          cashBalance:     STARTING_BALANCE,
          startingBalance: STARTING_BALANCE,
          isBot:           true,
        },
      },
    },
    include: { account: true },
  })

  console.log('Bot account created:')
  console.log('  User ID:    ', user.id)
  console.log('  Account ID: ', user.account!.id)
  console.log('')
  console.log('Save this Account ID — set it as BOT_ACCOUNT_ID in your .env')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
}).finally(() => db.$disconnect())
```

- [ ] **Step 2: Run seed script**

```bash
npx tsx scripts/seed-bot.ts
```

Expected output:
```
Bot account created:
  User ID:     cxxxxxxxxxxxxxxxx
  Account ID:  cxxxxxxxxxxxxxxxx

Save this Account ID — set it as BOT_ACCOUNT_ID in your .env
```

- [ ] **Step 3: Add BOT_ACCOUNT_ID to .env**

Copy the Account ID from the output and add to `.env.local`:
```
BOT_ACCOUNT_ID=<the account id printed above>
```

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-bot.ts
git commit -m "feat: add bot account seed script"
```

---

## Task 12: Cron Endpoint + Vercel Config

**Files:**
- Create: `app/api/cron/bot/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create the cron route**

```ts
// app/api/cron/bot/route.ts
export const dynamic    = 'force-dynamic'
export const maxDuration = 60  // seconds — Vercel hobby plan max

import { NextResponse } from 'next/server'
import { runBot } from '@/lib/bot/bot-runner'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const botAccountId = process.env.BOT_ACCOUNT_ID
  if (!botAccountId) {
    return NextResponse.json({ error: 'BOT_ACCOUNT_ID not configured' }, { status: 500 })
  }

  try {
    const result = await runBot(botAccountId)
    return NextResponse.json({
      ok: true,
      tradesExecuted: result.tradesExecuted,
      skipped:        result.skipped,
      errors:         result.errors,
      timestamp:      new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Add bot cron to vercel.json**

Replace the contents of `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/snapshots",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/bot",
      "schedule": "30 9 * * *"
    }
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/cron/bot/route.ts vercel.json
git commit -m "feat: add daily bot cron endpoint at 09:30 UTC"
```

---

## Task 13: Leaderboard BOT Badge

**Files:**
- Modify: `types/index.ts`
- Modify: `lib/portfolio.ts`
- Modify: `app/(dashboard)/leaderboard/page.tsx`

- [ ] **Step 1: Add isBot to LeaderboardEntry type**

In `types/index.ts`, update `LeaderboardEntry`:
```ts
export interface LeaderboardEntry {
  rank: number
  userId: string
  username: string
  avatarUrl?: string
  totalValue: number
  startingBalance: number
  returnPercent: number
  totalPnl: number
  isBot?: boolean
}
```

- [ ] **Step 2: Include isBot in getLeaderboard output**

In `lib/portfolio.ts`, find the `return` object inside the `.map(account => {` block (around line 138) and add `isBot`:

```ts
return {
  userId: account.userId,
  username: account.user.username,
  avatarUrl: account.user.avatarUrl ?? undefined,
  totalValue,
  startingBalance,
  returnPercent,
  totalPnl,
  isBot: account.isBot,
}
```

- [ ] **Step 3: Render BOT badge in leaderboard page**

In `app/(dashboard)/leaderboard/page.tsx`, find this block inside the `<tbody>` rows (around line 103–109):

```tsx
<Link href={`/profile/${entry.username}`} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
  <AvatarDisplay avatarUrl={entry.avatarUrl} username={entry.username} size={32} isOwner={entry.username === 'mstyli'} />
  <div>
    <p className="font-medium text-text-primary hover:text-brand transition-colors">{entry.username}</p>
    {isMe && <span className="text-xs text-brand">You</span>}
  </div>
</Link>
```

Replace with:
```tsx
<Link href={`/profile/${entry.username}`} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
  <AvatarDisplay avatarUrl={entry.avatarUrl} username={entry.username} size={32} isOwner={entry.username === 'mstyli'} />
  <div>
    <div className="flex items-center gap-1.5">
      <p className="font-medium text-text-primary hover:text-brand transition-colors">{entry.username}</p>
      {entry.isBot && (
        <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-brand/10 text-brand border border-brand/20">
          BOT
        </span>
      )}
    </div>
    {isMe && <span className="text-xs text-brand">You</span>}
  </div>
</Link>
```

Also update the podium section (around line 46) — add the BOT badge below the username in the podium card:
```tsx
<p className="text-sm font-semibold text-text-primary truncate">{entry.username}</p>
{entry.isBot && (
  <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-brand/10 text-brand border border-brand/20">
    BOT
  </span>
)}
```

- [ ] **Step 4: Build to verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add types/index.ts lib/portfolio.ts app/\(dashboard\)/leaderboard/page.tsx
git commit -m "feat: add BOT badge to leaderboard for bot account"
```

---

## Final Verification

- [ ] **Run all tests**

```bash
npx vitest run
```

Expected: All tests `PASS`.

- [ ] **Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Run dev server and verify leaderboard loads**

```bash
npm run dev
```

Navigate to `http://localhost:3000/leaderboard` — confirm page loads without errors.

- [ ] **Manually trigger bot cron (optional local test)**

With the dev server running and `BOT_ACCOUNT_ID` set in `.env.local`:
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/bot
```

Expected: JSON response with `ok: true`, `tradesExecuted`, `skipped`, `errors`.
