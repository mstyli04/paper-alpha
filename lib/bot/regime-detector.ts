// lib/bot/regime-detector.ts
import type { CandleData } from '@/types'
import { ema, atr, emaSlope, bollingerBands } from './indicators'

export type Regime = 'TRENDING' | 'RANGING' | 'BREAKOUT'

// 0.3% per period — raised from 0.001 to prevent slow oscillating markets
// from being misclassified as TRENDING (sine-wave slope ~0.0012)
const EMA_SLOPE_THRESHOLD = 0.003

export function detectRegime(candles: CandleData[]): Regime {
  if (candles.length < 35) return 'RANGING'

  const closes    = candles.map(c => c.close)
  const emaValues = ema(closes, 20)
  const atrValues = atr(candles, 14)
  const bands     = bollingerBands(closes, 20, 2)

  if (emaValues.length < 2 || atrValues.length < 21 || bands.length < 1) return 'RANGING'

  const recentAtr  = atrValues.slice(-20)
  const atrSma     = recentAtr.reduce((a, b) => a + b, 0) / recentAtr.length
  const currentAtr = atrValues[atrValues.length - 1]
  const atrSpike   = currentAtr > atrSma * 1.5

  const price        = closes[closes.length - 1]
  const band         = bands[bands.length - 1]
  const nearUpperBand = price >= band.upper * 0.98
  const nearLowerBand = price <= band.lower + Math.abs(band.lower) * 0.02

  if (atrSpike && (nearUpperBand || nearLowerBand)) return 'BREAKOUT'

  const slope       = Math.abs(emaSlope(emaValues))
  const slopeAbove  = slope > EMA_SLOPE_THRESHOLD
  const atrExpanding = currentAtr >= atrSma

  return slopeAbove && atrExpanding ? 'TRENDING' : 'RANGING'
}
