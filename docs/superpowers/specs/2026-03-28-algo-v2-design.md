# Trading Algorithm v2 — Design Spec
**Date:** 2026-03-28
**Project:** Paper Alpha
**Status:** Approved

---

## Problem

The current bot generates too many HOLD signals and misses profitable moves. Root causes:
- Momentum strategy requires an exact EMA crossover — a narrow, infrequent condition
- Mean reversion entry thresholds (lower band × 1.03, RSI < 45) are too strict
- No strategy fires during volatility breakouts
- No weekly trend context — bot enters longs during weekly downtrends and gets stopped out

---

## Solution: 4-Strategy Engine

Expand from 2 strategies to 4, add MACD + ADX indicators, add a weekly timeframe gate, and apply AI sentiment as a conviction modifier.

---

## Scope

**Modified files:**
- `lib/bot/indicators.ts` — add `macd()`, `adx()`
- `lib/bot/regime-detector.ts` — add `BREAKOUT` as a third regime
- `lib/bot/market-data.ts` — add `fetchBotCandlesWeekly()`
- `lib/bot/signal-engine.ts` — 4 strategies, multi-timeframe gate, sentiment modifier call
- `lib/bot/bot-runner.ts` — fetch weekly candles + sentiment score per asset, pass to `generateSignal`

**New files:**
- `lib/bot/sentiment.ts` — calls Anthropic SDK with recent price + volume context, returns score in `[−1.0, +1.0]`, cached in a `Map<symbol, score>` per cron cycle

**Unchanged:** `position-sizer.ts`, `trade-executor.ts`, `universe.ts`

---

## New Indicators

### MACD (12/26/9)
```
macd line    = EMA(12) − EMA(26)
signal line  = EMA(9) of macd line
histogram    = macd − signal
```
Returns `{ macd, signal, histogram }[]`. Used in momentum strategy as a second entry trigger.

### ADX (14)
```
+DI, −DI computed from directional movement
ADX = smoothed average of |+DI − −DI| / (+DI + −DI)
```
Returns `{ adx, plusDI, minusDI }[]`.

Thresholds:
- ADX < 20: choppy/weak — avoid momentum entries
- ADX 20–25: trend confirmed
- ADX > 25: strong trend (higher conviction)

---

## Regime Detection

Three regimes: `TRENDING | RANGING | BREAKOUT`

BREAKOUT is checked first:
```
BREAKOUT:  currentATR > 1.5 × ATR SMA(20)  AND  price within 2% of upper or lower Bollinger Band
TRENDING:  |emaSlope| > 0.001  AND  currentATR >= ATR SMA(20)
RANGING:   everything else
```

---

## Strategies

### Strategy 1 — Momentum (enhanced, TRENDING regime)

**Entry (BUY):** Not currently holding AND:
- (price crosses above 20 EMA **OR** MACD histogram turns positive) AND
- RSI between 45–75 AND
- ADX > 20

**Exit (SELL):** Currently holding AND:
- Price crosses below 20 EMA OR RSI > 80

**Conviction:**
```
ema_score  = clamp(emaSlope / 0.005, 0, 1)
rsi_score  = clamp((rsi − 50) / 30, 0, 1)
vol_score  = clamp(currVol / avg20Vol − 1, 0, 1)
adx_score  = clamp((adx − 20) / 30, 0, 1)   // 20→50 maps to 0→1
conviction = 0.3*ema_score + 0.3*rsi_score + 0.2*vol_score + 0.2*adx_score
```

---

### Strategy 2 — Mean Reversion (loosened, RANGING regime)

**Entry (BUY):** Not currently holding AND:
- Price ≤ lower Bollinger Band × 1.05 (was 1.03) AND
- RSI < 50 (was 45)

**Exit (SELL):** Currently holding AND:
- Price ≥ middle Bollinger Band OR RSI > 65

**Conviction:**
```
bandRange  = middle − lower
bandScore  = clamp((lower * 1.05 − price) / (lower * 0.05), 0, 1)
rsiScore   = clamp((50 − rsi) / 50, 0, 1)
conviction = 0.5*bandScore + 0.5*rsiScore
```

---

### Strategy 3 — Volatility Breakout (new, BREAKOUT regime)

**Entry (BUY):** Not currently holding AND:
- Price breaks above upper Bollinger Band AND
- Volume > 1.5× 20-period average volume

**Exit (SELL):** Currently holding AND:
- Price closes back inside Bollinger Bands OR RSI > 80

**Conviction:**
```
vol_surge  = clamp((currVol / avg20Vol − 1) / 2, 0, 1)   // 1.5× → 2.5× maps to 0→1
adx_score  = clamp((adx − 20) / 30, 0, 1)
conviction = 0.6*vol_surge + 0.4*adx_score
```

---

### Strategy 4 — Sentiment Modifier (cross-cutting)

Not a standalone strategy. Applied after any BUY signal from strategies 1–3.

`lib/bot/sentiment.ts` calls the Anthropic SDK with a short prompt containing recent price action (last 5 closes, volume trend, current regime) and asks for a sentiment score. Returns a number in `[−1.0, +1.0]`. Results are cached in a `Map<symbol, score>` that lives for the duration of a single cron run — one API call per symbol, not per signal.

```
if sentiment > 0.3:  conviction = min(conviction * 1.2, 1.0)   // bullish boost
if sentiment < −0.3: conviction = conviction * 0.7              // bearish suppression
// −0.3 to +0.3: no change
```

SELL signals are never modified by sentiment.

---

## Multi-Timeframe Gate

`market-data.ts` adds `fetchBotCandlesWeekly(symbol, assetType)` returning ~52 weekly candles.

Gate applied in `signal-engine.ts` after a BUY signal is generated:
```
weeklySlope = emaSlope(ema(weeklyCloses, 10))

if signal.action === 'BUY':
  if weeklySlope < −0.002 → weekly downtrend → suppress to HOLD
  if weeklySlope > 0.001  → weekly uptrend   → conviction += 0.1 (capped at 1.0)

SELL signals: never suppressed by weekly trend
```

Weekly candles are fetched once per asset per cron cycle alongside daily candles.

---

## Signal Generation Flow (updated)

```
generateSignal(symbol, dailyCandles, weeklyCandles, sentimentScore, isHeld):
  regime = detectRegime(dailyCandles)

  if regime === BREAKOUT:
    signal = breakoutSignal(...)
  else if regime === TRENDING && emaSlope >= 0:
    signal = momentumSignal(...)
  else:
    signal = meanReversionSignal(...)

  if signal.action === BUY:
    apply weekly gate (suppress or boost)
    apply sentiment modifier (boost or suppress)

  return signal
```

---

## Testing

Existing tests for `indicators.ts`, `regime-detector.ts`, `signal-engine.ts`, `position-sizer.ts` are extended to cover:
- `macd()` and `adx()` with known sequences
- BREAKOUT regime detection
- Breakout strategy BUY/SELL conditions
- Weekly gate: suppression when weekly slope < −0.002, boost when > 0.001
- Sentiment modifier: conviction scaling at boundary values (0.3, −0.3)

---

## Non-Goals

- No short selling
- No changes to position sizing, stop loss logic, or universe
- No ML models
- Sentiment is a modifier only — never the sole reason to BUY or SELL
