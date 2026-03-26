// lib/bot/regime-detector.ts
import type { CandleData } from '@/types'
import { ema, atr, emaSlope } from './indicators'

export type Regime = 'TRENDING' | 'RANGING'

const EMA_SLOPE_THRESHOLD = 0.005  // 0.5% per period

export function detectRegime(candles: CandleData[]): Regime {
  if (candles.length < 35) return 'RANGING'

  const closes = candles.map(c => c.close)
  const emaValues = ema(closes, 20)
  const atrValues = atr(candles, 14)

  if (emaValues.length < 2 || atrValues.length < 21) return 'RANGING'

  const slope = Math.abs(emaSlope(emaValues))
  const slopeAbove = slope > EMA_SLOPE_THRESHOLD

  // ATR expanding: current ATR >= 20-period SMA of ATR
  const recentAtr = atrValues.slice(-20)
  const atrSma = recentAtr.reduce((a, b) => a + b, 0) / recentAtr.length
  const currentAtr = atrValues[atrValues.length - 1]
  const atrExpanding = currentAtr >= atrSma

  return slopeAbove && atrExpanding ? 'TRENDING' : 'RANGING'
}
