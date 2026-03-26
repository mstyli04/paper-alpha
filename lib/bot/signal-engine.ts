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

  if (regime === 'TRENDING') {
    // Only apply momentum strategy for uptrends; downtrends use mean reversion
    const emaValues = ema(closes, 20)
    const slope = emaSlope(emaValues)
    if (slope >= 0) return momentumSignal(symbol, closes, volumes, isHeld)
  }

  return meanReversionSignal(symbol, closes, isHeld)
}
