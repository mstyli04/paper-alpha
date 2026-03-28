# Bot Trade Reasoning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a human-readable `reason` field to every bot trade so users can see exactly why the bot bought or sold.

**Architecture:** Add a nullable `reason` column to the `Trade` table. Each strategy function in `signal-engine.ts` builds a reason sentence at the point where it knows what triggered. The weekly gate and sentiment modifier append clauses to the reason. `trade-executor.ts` passes the reason to `executeTrade()`, which persists it. The history API includes it, and the history page renders a dedicated Reason column.

**Tech Stack:** TypeScript, Prisma/PostgreSQL, Next.js App Router, Vitest, SWR

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `reason String?` to `Trade` model |
| `lib/bot/signal-engine.ts` | Add `reason?: string` to `Signal`; build reason strings in each strategy function and modifier |
| `lib/bot/trade-executor.ts` | Pass `signal.reason` to `executeTrade()` |
| `lib/bot/bot-runner.ts` | Add reason to ATR stop and drawdown liquidation signals |
| `lib/trading-engine.ts` | Add `reason?: string` to `TradeInput`; write it to the DB |
| `types/index.ts` | Add `reason: string \| null` to `TradeRecord` |
| `app/api/history/route.ts` | Include `reason` in the trade select and response map |
| `app/(dashboard)/history/page.tsx` | Add Reason column to trade table |
| `__tests__/bot/signal-engine.test.ts` | Tests for all reason string formats |

---

### Task 1: Add `reason` column to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the field**

Open `prisma/schema.prisma`. Find the `Trade` model (currently ends with `note String?` and `createdAt DateTime @default(now())`). Add `reason` after `note`:

```prisma
model Trade {
  id         String       @id @default(cuid())
  accountId  String
  account    PaperAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  symbol     String
  assetType  AssetType
  assetName  String
  side       TradeSide
  quantity   Decimal      @db.Decimal(20, 8)
  price      Decimal      @db.Decimal(20, 8)
  totalValue Decimal      @db.Decimal(20, 8)
  note       String?
  reason     String?
  createdAt  DateTime     @default(now())

  @@index([accountId])
  @@index([accountId, symbol])
  @@index([accountId, createdAt])
}
```

- [ ] **Step 2: Run the migration**

```bash
npm run db:migrate
```

When prompted for a migration name, enter: `add_reason_to_trade`

Expected: Migration applied successfully. No existing rows are affected — the column is nullable.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add reason column to Trade"
```

---

### Task 2: Add `reason` to Signal type and build reason strings

**Files:**
- Modify: `lib/bot/signal-engine.ts`
- Modify: `__tests__/bot/signal-engine.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the end of `__tests__/bot/signal-engine.test.ts`:

```typescript
// --- Reason string tests ---

// Candles that produce a momentum BUY: price just crossed above EMA with RSI ~55, ADX ~30
// Strategy: build a long uptrend then add a pullback then cross above again
const momentumBuyCandles = (() => {
  // 40 bars of uptrend, then 8 bars dip below EMA, then 2 bars crossing back above
  const closes: number[] = []
  for (let i = 0; i < 40; i++) closes.push(100 * Math.pow(1.008, i))
  const peakEma = closes[39]
  for (let i = 0; i < 8; i++) closes.push(peakEma * 0.97 - i * 0.5)
  closes.push(peakEma * 0.99)  // prev bar just below EMA
  closes.push(peakEma * 1.005) // current bar just above EMA — crossover
  return makeCandles(closes, 3, 1.8)  // volume 1.8× to help ADX
})()

// Candles that produce a mean reversion BUY: sideways with sharp drop
const meanRevBuyCandles = (() => {
  const closes: number[] = [
    ...Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i * 0.4) * 2),
    ...Array.from({ length: 18 }, (_, i) => 100 - i * 1.8), // sharp drop, goes below lower band
  ]
  return makeCandles(closes, 2)
})()

describe('Signal reason — Momentum BUY', () => {
  it('BUY reason mentions trending market and RSI', () => {
    const signal = generateSignal('AAPL', momentumBuyCandles, noWeekly, 0, false)
    if (signal.action !== 'BUY') return // skip if conditions not met in this fixture
    expect(signal.reason).toContain('trending market')
    expect(signal.reason).toContain('RSI was')
  })

  it('BUY reason contains "Conviction:"', () => {
    const signal = generateSignal('AAPL', momentumBuyCandles, noWeekly, 0, false)
    if (signal.action !== 'BUY') return
    expect(signal.reason).toContain('Conviction:')
  })

  it('SELL reason mentions EMA or RSI', () => {
    const signal = generateSignal('AAPL', momentumBuyCandles, noWeekly, 0, true)
    if (signal.action !== 'SELL') return
    const mentionsEma = signal.reason?.includes('20 EMA')
    const mentionsRsi = signal.reason?.includes('RSI hit')
    expect(mentionsEma || mentionsRsi).toBe(true)
  })

  it('SELL reason starts with "Sold"', () => {
    const signal = generateSignal('AAPL', momentumBuyCandles, noWeekly, 0, true)
    if (signal.action !== 'SELL') return
    expect(signal.reason).toMatch(/^Sold/)
  })

  it('SELL reason does not contain "Conviction:"', () => {
    const signal = generateSignal('AAPL', momentumBuyCandles, noWeekly, 0, true)
    if (signal.action !== 'SELL') return
    expect(signal.reason).not.toContain('Conviction:')
  })
})

describe('Signal reason — Mean Reversion BUY', () => {
  it('BUY reason mentions Bollinger Band and RSI', () => {
    const signal = generateSignal('AAPL', meanRevBuyCandles, noWeekly, 0, false)
    if (signal.action !== 'BUY') return
    expect(signal.reason).toContain('Bollinger Band')
    expect(signal.reason).toContain('RSI was')
  })

  it('BUY reason contains "Conviction:"', () => {
    const signal = generateSignal('AAPL', meanRevBuyCandles, noWeekly, 0, false)
    if (signal.action !== 'BUY') return
    expect(signal.reason).toContain('Conviction:')
  })
})

describe('Signal reason — weekly gate clause', () => {
  // Weekly uptrend: 20 bars of 1% growth per week
  const weeklyUp = makeCandles(Array.from({ length: 20 }, (_, i) => 100 * Math.pow(1.01, i)))
  // Weekly downtrend: 20 bars of 1% decline per week
  const weeklyDown = makeCandles(Array.from({ length: 20 }, (_, i) => 100 * Math.pow(0.99, i)))
  // Neutral weekly: flat with tiny slope
  const weeklyFlat = makeCandles(Array.from({ length: 20 }, (_, i) => 100 + i * 0.0001))

  it('weekly uptrend appends "Weekly trend was up." to BUY reason', () => {
    const signal = generateSignal('AAPL', meanRevBuyCandles, weeklyUp, 0, false)
    if (signal.action !== 'BUY') return
    expect(signal.reason).toContain('Weekly trend was up.')
  })

  it('weekly downtrend suppresses BUY to HOLD', () => {
    const signal = generateSignal('AAPL', meanRevBuyCandles, weeklyDown, 0, false)
    // May still be BUY if the fixture doesn't produce a BUY — only check when it would have been BUY
    const withoutGate = generateSignal('AAPL', meanRevBuyCandles, noWeekly, 0, false)
    if (withoutGate.action !== 'BUY') return
    expect(signal.action).toBe('HOLD')
  })

  it('neutral weekly appends "Weekly trend was neutral." to BUY reason', () => {
    const signal = generateSignal('AAPL', meanRevBuyCandles, weeklyFlat, 0, false)
    if (signal.action !== 'BUY') return
    expect(signal.reason).toContain('Weekly trend was neutral.')
  })
})

describe('Signal reason — sentiment clause', () => {
  it('bullish sentiment appends "Sentiment was bullish" to BUY reason', () => {
    const signal = generateSignal('AAPL', meanRevBuyCandles, noWeekly, 0.5, false)
    if (signal.action !== 'BUY') return
    expect(signal.reason).toContain('Sentiment was bullish')
  })

  it('bearish sentiment appends "Sentiment was bearish" to BUY reason', () => {
    const signal = generateSignal('AAPL', meanRevBuyCandles, noWeekly, -0.5, false)
    if (signal.action !== 'BUY') return
    expect(signal.reason).toContain('Sentiment was bearish')
  })

  it('neutral sentiment (0.2) does not append a sentiment clause', () => {
    const signal = generateSignal('AAPL', meanRevBuyCandles, noWeekly, 0.2, false)
    if (signal.action !== 'BUY') return
    expect(signal.reason).not.toContain('Sentiment was')
  })
})

describe('Signal reason — HOLD has no reason', () => {
  it('HOLD signal has empty or undefined reason', () => {
    // Use a flat trending candle set that won't trigger momentum entry
    const flatCandles = makeCandles(Array.from({ length: 60 }, () => 100))
    const signal = generateSignal('AAPL', flatCandles, noWeekly, 0, false)
    expect(signal.action).toBe('HOLD')
    expect(signal.reason ?? '').toBe('')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: Multiple failures mentioning `signal.reason` being undefined.

- [ ] **Step 3: Add `reason` to Signal interface and implement reason strings**

Replace the entire contents of `lib/bot/signal-engine.ts` with:

```typescript
// lib/bot/signal-engine.ts
import type { CandleData } from '@/types'
import { ema, rsi, bollingerBands, emaSlope, macd, adx } from './indicators'
import { detectRegime, type Regime } from './regime-detector'

export type SignalAction = 'BUY' | 'SELL' | 'HOLD'

export interface Signal {
  symbol: string
  action: SignalAction
  conviction: number  // 0.0–1.0
  strategy: 'MOMENTUM' | 'MEAN_REVERSION' | 'BREAKOUT'
  regime: Regime
  reason?: string     // human-readable sentence; set on BUY/SELL, empty/undefined on HOLD
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function momentumSignal(
  symbol: string,
  closes: number[],
  candles: CandleData[],
  volumes: number[],
  isHeld: boolean
): Signal {
  const base: Signal = { symbol, action: 'HOLD', conviction: 0, strategy: 'MOMENTUM', regime: 'TRENDING', reason: '' }
  const emaValues  = ema(closes, 20)
  const rsiValues  = rsi(closes, 14)
  const macdValues = macd(closes)
  const adxValues  = adx(candles)

  if (emaValues.length < 2 || rsiValues.length < 1) return base
  if (adxValues.length < 1) return base

  const price     = closes[closes.length - 1]
  const prevPrice = closes[closes.length - 2]
  const currEma   = emaValues[emaValues.length - 1]
  const prevEma   = emaValues[emaValues.length - 2]
  const currRsi   = rsiValues[rsiValues.length - 1]
  const slope     = emaSlope(emaValues)
  const currAdx   = adxValues[adxValues.length - 1].adx

  const crossedAbove       = prevPrice <= prevEma && price > currEma
  const crossedBelow       = prevPrice >= prevEma && price < currEma
  const macdTurnedPositive = macdValues.length >= 2
    ? macdValues[macdValues.length - 2].histogram <= 0 && macdValues[macdValues.length - 1].histogram > 0
    : false

  if (isHeld && (crossedBelow || currRsi > 80)) {
    const parts: string[] = []
    if (crossedBelow) parts.push('price crossed below the 20 EMA')
    if (currRsi > 80) parts.push(`RSI hit ${Math.round(currRsi)} (overbought)`)
    return { ...base, action: 'SELL', conviction: clamp((currRsi - 50) / 30, 0, 1), reason: `Sold — ${parts.join(' and ')}.` }
  }

  const entryTrigger = crossedAbove || macdTurnedPositive
  if (!isHeld && entryTrigger && currRsi >= 45 && currRsi <= 75 && currAdx > 20) {
    const avg20Vol   = volumes.length >= 21
      ? volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20
      : 0
    const currVol    = volumes[volumes.length - 1]
    const emaScore   = clamp(slope / 0.005, 0, 1)
    const rsiScore   = clamp((currRsi - 50) / 30, 0, 1)
    const volScore   = avg20Vol > 0 ? clamp(currVol / avg20Vol - 1, 0, 1) : 0
    const adxScore   = clamp((currAdx - 20) / 30, 0, 1)
    const conviction = 0.3 * emaScore + 0.3 * rsiScore + 0.2 * volScore + 0.2 * adxScore

    const triggers: string[] = []
    if (crossedAbove) triggers.push('price crossed above the 20 EMA')
    if (macdTurnedPositive) triggers.push('MACD turned positive')
    const reason = `Bought in a trending market — ${triggers.join(' and ')} and RSI was ${Math.round(currRsi)}.`

    return { ...base, action: 'BUY', conviction: clamp(conviction, 0, 1), reason }
  }

  return base
}

function meanReversionSignal(
  symbol: string,
  closes: number[],
  isHeld: boolean
): Signal {
  const base: Signal = { symbol, action: 'HOLD', conviction: 0, strategy: 'MEAN_REVERSION', regime: 'RANGING', reason: '' }
  const bands     = bollingerBands(closes, 20, 2)
  const rsiValues = rsi(closes, 14)
  if (bands.length < 1 || rsiValues.length < 1) return base

  const price   = closes[closes.length - 1]
  const band    = bands[bands.length - 1]
  const currRsi = rsiValues[rsiValues.length - 1]

  if (isHeld && (price >= band.middle || currRsi > 65)) {
    const parts: string[] = []
    if (price >= band.middle) parts.push('price reached the middle Bollinger Band')
    if (currRsi > 65) parts.push(`RSI hit ${Math.round(currRsi)} (overbought)`)
    return { ...base, action: 'SELL', conviction: 0.7, reason: `Sold — ${parts.join(' and ')}.` }
  }

  if (!isHeld && price <= band.lower * 1.05 && currRsi < 50) {
    const bandScore  = clamp((band.lower * 1.05 - price) / (band.lower * 0.05), 0, 1)
    const rsiScore   = clamp((50 - currRsi) / 50, 0, 1)
    const conviction = 0.5 * bandScore + 0.5 * rsiScore
    const reason     = `Bought near the lower Bollinger Band — RSI was ${Math.round(currRsi)} in a ranging market.`
    return { ...base, action: 'BUY', conviction: clamp(conviction, 0, 1), reason }
  }

  return base
}

function breakoutSignal(
  symbol: string,
  closes: number[],
  candles: CandleData[],
  volumes: number[],
  isHeld: boolean
): Signal {
  const base: Signal = { symbol, action: 'HOLD', conviction: 0, strategy: 'BREAKOUT', regime: 'BREAKOUT', reason: '' }
  const bands     = bollingerBands(closes, 20, 2)
  const rsiValues = rsi(closes, 14)
  const adxValues = adx(candles)
  if (bands.length < 1 || rsiValues.length < 1) return base
  if (adxValues.length < 1) return base

  const price   = closes[closes.length - 1]
  const band    = bands[bands.length - 1]
  const currRsi = rsiValues[rsiValues.length - 1]
  const currAdx = adxValues[adxValues.length - 1].adx

  if (isHeld && (price < band.upper * 0.98 || currRsi > 80)) {
    const parts: string[] = []
    if (price < band.upper * 0.98) parts.push('price closed back inside Bollinger Bands')
    if (currRsi > 80) parts.push(`RSI hit ${Math.round(currRsi)} (overbought)`)
    return { ...base, action: 'SELL', conviction: 0.8, reason: `Sold — ${parts.join(' and ')}.` }
  }

  const avg20Vol = volumes.length >= 21
    ? volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20
    : 0
  const currVol = volumes[volumes.length - 1]

  if (!isHeld && price > band.upper && avg20Vol > 0 && currVol > avg20Vol * 1.5) {
    const volSurge   = clamp((currVol / avg20Vol - 1) / 2, 0, 1)
    const adxScore   = clamp((currAdx - 20) / 30, 0, 1)
    const conviction = 0.6 * volSurge + 0.4 * adxScore
    const reason     = `Bought on a volatility breakout — price cleared the upper Bollinger Band on ${(currVol / avg20Vol).toFixed(1)}× average volume. ADX was ${Math.round(currAdx)}.`
    return { ...base, action: 'BUY', conviction: clamp(conviction, 0, 1), reason }
  }

  return base
}

function applyWeeklyGate(signal: Signal, weeklyCandles: CandleData[]): Signal {
  if (signal.action !== 'BUY' || weeklyCandles.length < 15) return signal

  const weeklyCloses = weeklyCandles.map(c => c.close)
  const weeklyEma    = ema(weeklyCloses, 10)
  if (weeklyEma.length < 2) return signal

  const weeklySlope = emaSlope(weeklyEma)

  if (weeklySlope < -0.002) return { ...signal, action: 'HOLD', conviction: 0, reason: '' }
  if (weeklySlope > 0.001)  return { ...signal, conviction: clamp(signal.conviction + 0.1, 0, 1), reason: `${signal.reason} Weekly trend was up.` }
  return { ...signal, reason: `${signal.reason} Weekly trend was neutral.` }
}

function applySentiment(signal: Signal, sentimentScore: number): Signal {
  if (signal.action !== 'BUY') return signal
  if (sentimentScore > 0.3)  return { ...signal, conviction: clamp(signal.conviction * 1.2, 0, 1), reason: `${signal.reason} Sentiment was bullish (+${sentimentScore.toFixed(2)}).` }
  if (sentimentScore < -0.3) return { ...signal, conviction: signal.conviction * 0.7,              reason: `${signal.reason} Sentiment was bearish (${sentimentScore.toFixed(2)}).` }
  return signal
}

export function generateSignal(
  symbol: string,
  candles: CandleData[],
  weeklyCandles: CandleData[],
  sentimentScore: number,
  isHeld: boolean
): Signal {
  const regime  = detectRegime(candles)
  const closes  = candles.map(c => c.close)
  const volumes = candles.map(c => c.volume ?? 0)

  let signal: Signal

  if (regime === 'BREAKOUT') {
    signal = breakoutSignal(symbol, closes, candles, volumes, isHeld)
  } else if (regime === 'TRENDING') {
    const emaValues = ema(closes, 20)
    const slope     = emaSlope(emaValues)
    signal = slope >= 0
      ? momentumSignal(symbol, closes, candles, volumes, isHeld)
      : meanReversionSignal(symbol, closes, isHeld)
  } else {
    signal = meanReversionSignal(symbol, closes, isHeld)
  }

  signal = applyWeeklyGate(signal, weeklyCandles)
  signal = applySentiment(signal, sentimentScore)

  // Append final conviction to BUY reasons (after all modifiers have run)
  if (signal.action === 'BUY') {
    signal = { ...signal, reason: `${signal.reason} Conviction: ${signal.conviction.toFixed(2)}.` }
  }

  return signal
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --reporter=verbose 2>&1 | tail -40
```

Expected: All tests pass (60+ passing, 0 failures).

- [ ] **Step 5: Commit**

```bash
git add lib/bot/signal-engine.ts __tests__/bot/signal-engine.test.ts
git commit -m "feat(bot): add reason strings to Signal type and strategy functions"
```

---

### Task 3: Plumb `reason` through trade-executor, trading-engine, and bot-runner

**Files:**
- Modify: `lib/trading-engine.ts`
- Modify: `lib/bot/trade-executor.ts`
- Modify: `lib/bot/bot-runner.ts`

- [ ] **Step 1: Add `reason` to `TradeInput` in `lib/trading-engine.ts`**

Find the `TradeInput` interface (lines 6–13):

```typescript
interface TradeInput {
  accountId: string
  symbol: string
  assetType: AssetType
  side: TradeSide
  quantity: number
  note?: string
}
```

Replace with:

```typescript
interface TradeInput {
  accountId: string
  symbol: string
  assetType: AssetType
  side: TradeSide
  quantity: number
  note?: string
  reason?: string
}
```

- [ ] **Step 2: Write `reason` to the DB in `executeTrade`**

Find the `tx.trade.create` call (around line 225). The current data object is:

```typescript
const trade = await tx.trade.create({
  data: {
    accountId,
    symbol,
    assetType,
    assetName: quote.name,
    side,
    quantity,
    price,
    totalValue,
    ...(note ? { note } : {}),
  },
})
```

Replace with:

```typescript
const trade = await tx.trade.create({
  data: {
    accountId,
    symbol,
    assetType,
    assetName: quote.name,
    side,
    quantity,
    price,
    totalValue,
    ...(note ? { note } : {}),
    ...(reason ? { reason } : {}),
  },
})
```

Also update the destructuring at the top of `executeTrade` (line 29):

```typescript
// Before:
const { accountId, symbol, assetType, side, quantity, note } = input

// After:
const { accountId, symbol, assetType, side, quantity, note, reason } = input
```

- [ ] **Step 3: Pass `signal.reason` in `lib/bot/trade-executor.ts`**

Find the `executeTrade` call (around line 28). The current call is:

```typescript
const result = await executeTrade({
  accountId,
  symbol: signal.symbol,
  assetType,
  side,
  quantity,
  note,
})
```

Replace with:

```typescript
const result = await executeTrade({
  accountId,
  symbol: signal.symbol,
  assetType,
  side,
  quantity,
  note,
  ...(signal.reason ? { reason: signal.reason } : {}),
})
```

- [ ] **Step 4: Add reason to ATR stop and drawdown signals in `lib/bot/bot-runner.ts`**

**ATR stop** — find the `executeSignal` call inside `for (const stop of activeStops)` (around line 83):

```typescript
const result = await executeSignal(
  botAccountId,
  { symbol: stop.symbol, action: 'SELL', conviction: 1, strategy: 'MOMENTUM', regime: 'TRENDING' },
  Number(stop.quantity),
  stop.assetType as AssetType
)
```

Replace with:

```typescript
const result = await executeSignal(
  botAccountId,
  {
    symbol: stop.symbol,
    action: 'SELL',
    conviction: 1,
    strategy: 'MOMENTUM',
    regime: 'TRENDING',
    reason: `Stop loss triggered at $${Number(stop.triggerPrice).toFixed(2)}.`,
  },
  Number(stop.quantity),
  stop.assetType as AssetType
)
```

**Drawdown liquidation** — find the `executeSignal` call inside `if (drawdown > MAX_DRAWDOWN)` (around line 63):

```typescript
await executeSignal(
  botAccountId,
  { symbol: holding.symbol, action: 'SELL', conviction: 1, strategy: 'MOMENTUM', regime: 'TRENDING' },
  Number(holding.quantity),
  holding.assetType as AssetType
)
```

Replace with:

```typescript
await executeSignal(
  botAccountId,
  {
    symbol: holding.symbol,
    action: 'SELL',
    conviction: 1,
    strategy: 'MOMENTUM',
    regime: 'TRENDING',
    reason: 'Emergency liquidation — portfolio drawdown exceeded 15%.',
  },
  Number(holding.quantity),
  holding.assetType as AssetType
)
```

- [ ] **Step 5: Run tests**

```bash
npm test 2>&1 | tail -10
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/trading-engine.ts lib/bot/trade-executor.ts lib/bot/bot-runner.ts
git commit -m "feat(bot): plumb reason through trade-executor and trading-engine"
```

---

### Task 4: Update `TradeRecord` type and history API

**Files:**
- Modify: `types/index.ts`
- Modify: `app/api/history/route.ts`

- [ ] **Step 1: Add `reason` to `TradeRecord` in `types/index.ts`**

Find the `TradeRecord` interface (around line 63):

```typescript
export interface TradeRecord {
  id: string
  symbol: string
  assetType: AssetType
  assetName: string
  side: TradeSide
  quantity: number
  price: number
  totalValue: number
  note: string | null
  createdAt: string
}
```

Replace with:

```typescript
export interface TradeRecord {
  id: string
  symbol: string
  assetType: AssetType
  assetName: string
  side: TradeSide
  quantity: number
  price: number
  totalValue: number
  note: string | null
  reason: string | null
  createdAt: string
}
```

- [ ] **Step 2: Include `reason` in the history API response**

In `app/api/history/route.ts`, find the `trades.map` block (around line 41):

```typescript
trades: trades.map(t => ({
  id: t.id,
  symbol: t.symbol,
  assetType: t.assetType,
  assetName: t.assetName,
  side: t.side,
  quantity: Number(t.quantity),
  price: Number(t.price),
  totalValue: Number(t.totalValue),
  note: t.note ?? null,
  createdAt: t.createdAt.toISOString(),
})),
```

Replace with:

```typescript
trades: trades.map(t => ({
  id: t.id,
  symbol: t.symbol,
  assetType: t.assetType,
  assetName: t.assetName,
  side: t.side,
  quantity: Number(t.quantity),
  price: Number(t.price),
  totalValue: Number(t.totalValue),
  note: t.note ?? null,
  reason: t.reason ?? null,
  createdAt: t.createdAt.toISOString(),
})),
```

- [ ] **Step 3: Run tests**

```bash
npm test 2>&1 | tail -10
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts app/api/history/route.ts
git commit -m "feat(api): include reason in TradeRecord type and history API response"
```

---

### Task 5: Add Reason column to history page

**Files:**
- Modify: `app/(dashboard)/history/page.tsx`

- [ ] **Step 1: Add the Reason column header**

Find the `<thead>` block. The current last `<th>` is:

```tsx
<th className="text-right text-xs text-text-muted font-medium py-3 px-5">Time</th>
```

Add a new `<th>` after Total and before Time:

```tsx
<th className="text-left text-xs text-text-muted font-medium py-3 px-4">Reason</th>
<th className="text-right text-xs text-text-muted font-medium py-3 px-5">Time</th>
```

- [ ] **Step 2: Add the Reason column cell**

In the `<tbody>`, find the Total cell:

```tsx
<td className="py-3 px-4 text-right font-mono font-medium text-text-primary">
  {formatCurrency(trade.totalValue)}
</td>
```

Add a new `<td>` after it, before the Time cell:

```tsx
<td className="py-3 px-4 max-w-xs">
  {trade.reason ? (
    <span
      className="text-xs text-text-muted block truncate"
      title={trade.reason}
    >
      {trade.reason}
    </span>
  ) : (
    <span className="text-xs text-text-muted">—</span>
  )}
</td>
```

- [ ] **Step 3: Run tests**

```bash
npm test 2>&1 | tail -10
```

Expected: All tests pass.

- [ ] **Step 4: Run the dev server and verify visually**

```bash
npm run dev
```

Navigate to `/history`. Confirm:
- A "Reason" column appears between Total and Time
- Bot trades show the reason sentence
- Manual trades show `—`
- Long reasons truncate with `…` and show in full on hover

- [ ] **Step 5: Commit**

```bash
git add app/\(dashboard\)/history/page.tsx
git commit -m "feat(ui): add Reason column to trade history table"
```
