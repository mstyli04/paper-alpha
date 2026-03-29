# Bot Run Logging — Design Spec
**Date:** 2026-03-29
**Project:** Paper Alpha
**Status:** Approved

---

## Problem

The algorithm bot runs nightly via Vercel Cron but has no persistent logging. When it produces 0 trades there is no way to tell from the app whether it ran at all, whether market data fetches failed, or why each asset was skipped. Diagnosis requires digging through Vercel function logs.

---

## Solution

Add two Prisma tables (`BotRun`, `BotRunAsset`) written during each cron run, and a `/bot-logs` dashboard page that shows a run history with per-asset detail.

---

## Scope

**New files:**
- `app/(dashboard)/bot-logs/page.tsx` — run list + expandable per-asset tables

**Modified files:**
- `prisma/schema.prisma` — add `BotRun`, `BotRunAsset` models
- `lib/bot/bot-runner.ts` — write run + asset log rows, label skip reasons
- `lib/bot/signal-engine.ts` — add `skipReason?: string` to `SignalResult`
- `app/(dashboard)/layout.tsx` (or nav component) — add Bot Logs sidebar link

**Unchanged:** all API routes, market data, indicators, trading engine, position sizer

---

## Data Model

### `BotRun`

```prisma
model BotRun {
  id                     String        @id @default(cuid())
  startedAt              DateTime
  finishedAt             DateTime?
  status                 BotRunStatus  @default(OK)
  tradesExecuted         Int           @default(0)
  skipped                Int           @default(0)
  portfolioValueSnapshot Decimal       @db.Decimal(20, 8)
  errors                 String[]
  assets                 BotRunAsset[]

  @@index([startedAt])
}

enum BotRunStatus {
  OK
  ERROR
  TIMEOUT
}
```

### `BotRunAsset`

```prisma
model BotRunAsset {
  id          String   @id @default(cuid())
  runId       String
  run         BotRun   @relation(fields: [runId], references: [id], onDelete: Cascade)
  symbol      String
  regime      String   // TRENDING | RANGING | BREAKOUT | UNKNOWN
  signal      String   // BUY | SELL | HOLD | UNKNOWN
  conviction  Decimal? @db.Decimal(6, 4)
  action      String   // BOUGHT | SOLD | SKIPPED | ERROR
  skipReason  String?
  candleCount Int

  @@index([runId])
  @@index([symbol])
}
```

### Retention

The cron job purges `BotRun` records older than 90 days at the end of each run (cascades to `BotRunAsset` via `onDelete: Cascade`).

---

## Skip Reason Labels

Each current unlabelled `skipped++` in `bot-runner.ts` is replaced with a labelled asset log row:

| Situation | `skipReason` |
|-----------|-------------|
| `candles.length < 30` | `"candles < 30 (got N)"` |
| `openCount >= MAX_POSITIONS` | `"max positions (10)"` |
| crypto allocation cap hit | `"crypto cap 30%"` |
| sector allocation cap hit | `"sector cap 40%"` |
| `quantity <= 0` | `"quantity 0 (low conviction or price too high)"` |
| `price × qty > cashBalance` | `"insufficient cash"` |
| signal = HOLD | `"signal HOLD"` |
| trade execution failed | `"execution error: <message>"` |

---

## `SignalResult` Change

`lib/bot/signal-engine.ts` exports:

```typescript
interface SignalResult {
  signal: 'BUY' | 'SELL' | 'HOLD'
  conviction: number
  regime: 'TRENDING' | 'RANGING' | 'BREAKOUT' | 'UNKNOWN'
  skipReason?: string   // ← new: populated when signal = HOLD
}
```

The signal engine sets `skipReason` on HOLD signals where the reason is knowable (e.g. `"ADX < 20"`, `"weekly gate: negative EMA slope"`, `"RSI out of range"`, `"mean reversion: price above mid-band"`). The runner uses this as the asset's `skipReason` when logging a HOLD.

---

## Bot Runner Changes

### Run lifecycle

```typescript
// 1. Create run record at start
const run = await db.botRun.create({
  data: { startedAt: new Date(), portfolioValueSnapshot: portfolioValue, status: 'OK' }
})

// 2. Per-asset: write BotRunAsset row after each decision
await db.botRunAsset.create({
  data: {
    runId: run.id,
    symbol,
    regime: signal.regime,
    signal: signal.signal,
    conviction: signal.conviction ?? null,
    action,          // 'BOUGHT' | 'SOLD' | 'SKIPPED' | 'ERROR'
    skipReason,      // null for BOUGHT/SOLD
    candleCount: candles.length,
  }
})

// 3. Update run record at end
await db.botRun.update({
  where: { id: run.id },
  data: { finishedAt: new Date(), status: 'OK', tradesExecuted, skipped, errors }
})

// 4. Purge runs older than 90 days
await db.botRun.deleteMany({
  where: { startedAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } }
})
```

If the runner throws before finishing, the run record stays with `status: OK` and no `finishedAt` — the `/bot-logs` page treats any run with `finishedAt = null` as `TIMEOUT`.

---

## UI — `/bot-logs`

### Run list

Server component. Fetches last 30 `BotRun` records ordered by `startedAt DESC`, each with its `assets` count.

```
┌─────────────────────────────────────────────────────┐
│ Bot Runs                                            │
├─────────────────────────────────────────────────────┤
│ Mar 29  20:10 UTC  ✅ OK     2 trades  38 skipped  │ ← click to expand
│ Mar 28  20:10 UTC  ✅ OK     0 trades  40 skipped  │
│ Mar 27  20:10 UTC  ❌ ERROR  0 trades  12 skipped  │
│ Mar 26  20:10 UTC  ⏱ TIMEOUT 0 trades  —           │
└─────────────────────────────────────────────────────┘
```

Status icons: `✅` OK with trades, `○` OK with 0 trades, `❌` ERROR, `⏱` TIMEOUT (finishedAt is null).

### Expanded run

Client component (accordion). Per-asset table with filter tabs: All / Traded / Skipped / Error.

```
Symbol  Regime    Signal  Action   Candles  Skip Reason / Notes
──────  ────────  ──────  ───────  ───────  ─────────────────────────
AAPL    TRENDING  BUY     BOUGHT   60       —
NVDA    RANGING   HOLD    SKIPPED  60       signal HOLD
BTC     TRENDING  BUY     SKIPPED  60       quantity 0 (low conviction)
ETH     UNKNOWN   HOLD    SKIPPED  8        candles < 30 (got 8)
```

Errors from `run.errors[]` shown in a red callout above the table.

### Page header

```
<h1>Bot Runs</h1>
<p>Nightly algorithm run history — last 90 days</p>
```

---

## Navigation

Add "Bot Logs" link to the dashboard sidebar nav, with a `Bot` icon (or `Activity`), between History and Alerts.

---

## Testing

No new unit tests — DB writes and UI only. Existing 60 tests must remain green. Verify with `npm test`.
