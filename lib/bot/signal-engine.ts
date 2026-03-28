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
  const base: Signal = { symbol, action: 'HOLD', conviction: 0, strategy: 'MOMENTUM', regime: 'TRENDING' }
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
  const currAdx   = adxValues.length > 0 ? adxValues[adxValues.length - 1].adx : 0

  const crossedAbove       = prevPrice <= prevEma && price > currEma
  const crossedBelow       = prevPrice >= prevEma && price < currEma
  const macdTurnedPositive = macdValues.length >= 2
    ? macdValues[macdValues.length - 2].histogram <= 0 && macdValues[macdValues.length - 1].histogram > 0
    : false

  if (isHeld && (crossedBelow || currRsi > 80)) {
    return { ...base, action: 'SELL', conviction: clamp((currRsi - 50) / 30, 0, 1) }
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

  const price   = closes[closes.length - 1]
  const band    = bands[bands.length - 1]
  const currRsi = rsiValues[rsiValues.length - 1]

  if (isHeld && (price >= band.middle || currRsi > 65)) {
    return { ...base, action: 'SELL', conviction: 0.7 }
  }

  if (!isHeld && price <= band.lower * 1.05 && currRsi < 50) {
    const bandScore  = clamp((band.lower * 1.05 - price) / (band.lower * 0.05), 0, 1)
    const rsiScore   = clamp((50 - currRsi) / 50, 0, 1)
    const conviction = 0.5 * bandScore + 0.5 * rsiScore
    return { ...base, action: 'BUY', conviction: clamp(conviction, 0, 1) }
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
  const base: Signal = { symbol, action: 'HOLD', conviction: 0, strategy: 'BREAKOUT', regime: 'BREAKOUT' }
  const bands     = bollingerBands(closes, 20, 2)
  const rsiValues = rsi(closes, 14)
  const adxValues = adx(candles)
  if (bands.length < 1 || rsiValues.length < 1) return base
  if (adxValues.length < 1) return base

  const price   = closes[closes.length - 1]
  const band    = bands[bands.length - 1]
  const currRsi = rsiValues[rsiValues.length - 1]
  const currAdx = adxValues.length > 0 ? adxValues[adxValues.length - 1].adx : 0

  // Sell when the breakout fails (price falls back inside bands) or RSI overextended
  if (isHeld && (price < band.upper * 0.98 || currRsi > 80)) {
    return { ...base, action: 'SELL', conviction: 0.8 }
  }

  const avg20Vol = volumes.length >= 21
    ? volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20
    : 0
  const currVol = volumes[volumes.length - 1]

  if (!isHeld && price > band.upper && avg20Vol > 0 && currVol > avg20Vol * 1.5) {
    const volSurge   = clamp((currVol / avg20Vol - 1) / 2, 0, 1)
    const adxScore   = clamp((currAdx - 20) / 30, 0, 1)
    const conviction = 0.6 * volSurge + 0.4 * adxScore
    return { ...base, action: 'BUY', conviction: clamp(conviction, 0, 1) }
  }

  return base
}

function applyWeeklyGate(signal: Signal, weeklyCandles: CandleData[]): Signal {
  // Fewer than 15 weekly candles = insufficient data; gate is bypassed (no-op)
  // This also handles the case where weekly fetch failed — callers should be aware
  // that a failed weekly fetch will not block trades.
  if (signal.action !== 'BUY' || weeklyCandles.length < 15) return signal

  const weeklyCloses = weeklyCandles.map(c => c.close)
  const weeklyEma    = ema(weeklyCloses, 10)
  if (weeklyEma.length < 2) return signal

  const weeklySlope = emaSlope(weeklyEma)

  if (weeklySlope < -0.002) return { ...signal, action: 'HOLD', conviction: 0 }
  if (weeklySlope > 0.001)  return { ...signal, conviction: clamp(signal.conviction + 0.1, 0, 1) }
  return signal
}

function applySentiment(signal: Signal, sentimentScore: number): Signal {
  if (signal.action !== 'BUY') return signal
  if (sentimentScore > 0.3)  return { ...signal, conviction: clamp(signal.conviction * 1.2, 0, 1) }
  if (sentimentScore < -0.3) return { ...signal, conviction: signal.conviction * 0.7 }
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
  return signal
}
