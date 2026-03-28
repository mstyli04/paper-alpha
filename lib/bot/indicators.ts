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

export interface MACDResult {
  macd: number
  signal: number
  histogram: number
}

/** MACD (default 12/26/9). Returns aligned array where each entry covers the same candle. */
export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): MACDResult[] {
  const fastEma = ema(closes, fast)
  const slowEma = ema(closes, slow)
  if (fastEma.length === 0 || slowEma.length === 0) return []

  // fastEma[i] and slowEma[i] both correspond to closes[i + period - 1]
  // slowEma is shorter; align by offsetting fastEma
  const offset = slow - fast
  const macdLine = slowEma.map((v, i) => fastEma[i + offset] - v)

  const sigLine = ema(macdLine, signalPeriod)
  if (sigLine.length === 0) return []

  const sigOffset = macdLine.length - sigLine.length
  return sigLine.map((sig, i) => ({
    macd: macdLine[i + sigOffset],
    signal: sig,
    histogram: macdLine[i + sigOffset] - sig,
  }))
}

export interface ADXResult {
  adx: number
  plusDI: number
  minusDI: number
}

/** Wilder ADX (default period 14). Requires at least period*2+1 candles. */
export function adx(candles: CandleData[], period = 14): ADXResult[] {
  if (candles.length < period * 2 + 1) return []

  const plusDM: number[] = []
  const minusDM: number[] = []
  const tr: number[] = []

  for (let i = 1; i < candles.length; i++) {
    const { high, low } = candles[i]
    const { high: pH, low: pL, close: pC } = candles[i - 1]
    const up   = high - pH
    const down = pL - low
    plusDM.push(up > down && up > 0 ? up : 0)
    minusDM.push(down > up && down > 0 ? down : 0)
    tr.push(Math.max(high - low, Math.abs(high - pC), Math.abs(low - pC)))
  }

  // Wilder smoothing: initial = sum of first `period`, then rolling subtract-and-add
  const wilderSmooth = (arr: number[]): number[] => {
    let val = arr.slice(0, period).reduce((a, b) => a + b, 0)
    const out = [val]
    for (let i = period; i < arr.length; i++) {
      val = val - val / period + arr[i]
      out.push(val)
    }
    return out
  }

  const sTR  = wilderSmooth(tr)
  const sPDM = wilderSmooth(plusDM)
  const sMDM = wilderSmooth(minusDM)

  const dxArr: number[] = []
  const diArr: { plusDI: number; minusDI: number }[] = []

  for (let i = 0; i < sTR.length; i++) {
    const pdi = sTR[i] > 0 ? (sPDM[i] / sTR[i]) * 100 : 0
    const mdi = sTR[i] > 0 ? (sMDM[i] / sTR[i]) * 100 : 0
    const sum = pdi + mdi
    dxArr.push(sum > 0 ? (Math.abs(pdi - mdi) / sum) * 100 : 0)
    diArr.push({ plusDI: pdi, minusDI: mdi })
  }

  if (dxArr.length < period) return []

  // ADX = Wilder smooth of DX, starting once we have `period` DX values
  let adxVal = dxArr.slice(0, period).reduce((a, b) => a + b, 0) / period
  const result: ADXResult[] = []

  for (let i = period - 1; i < dxArr.length; i++) {
    if (i > period - 1) {
      adxVal = (adxVal * (period - 1) + dxArr[i]) / period
    }
    result.push({ adx: adxVal, ...diArr[i] })
  }

  return result
}
