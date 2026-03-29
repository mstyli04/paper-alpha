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

    const parts: string[] = []
    if (crossedAbove) parts.push('price crossed above the 20 EMA')
    if (macdTurnedPositive) parts.push('MACD turned positive')
    parts.push(`RSI was ${Math.round(currRsi)}`)
    const reason = `Bought in a trending market — ${parts.join(' and ')}.`

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
  if (sentimentScore < -0.3) return { ...signal, conviction: clamp(signal.conviction * 0.7, 0, 1), reason: `${signal.reason} Sentiment was bearish (${sentimentScore.toFixed(2)}).` }
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

  // Append final conviction to BUY reasons after all modifiers have run
  if (signal.action === 'BUY') {
    signal = { ...signal, reason: `${signal.reason} Conviction: ${signal.conviction.toFixed(2)}.` }
  }

  return signal
}
