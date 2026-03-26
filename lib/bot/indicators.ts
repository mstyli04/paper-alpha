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
