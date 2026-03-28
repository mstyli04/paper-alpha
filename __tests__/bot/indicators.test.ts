// __tests__/bot/indicators.test.ts
import { describe, it, expect } from 'vitest'
import { ema, rsi, atr, bollingerBands, emaSlope, macd, adx, type MACDResult, type ADXResult } from '@/lib/bot/indicators'
import type { CandleData } from '@/types'

// 30 synthetic closes: gentle up trend
const closes30 = Array.from({ length: 30 }, (_, i) => 100 + i * 0.5)

// 30 candles with high/low for ATR
const candles30: CandleData[] = closes30.map((c, i) => ({
  time: i,
  open: c - 0.2,
  high: c + 1,
  low: c - 1,
  close: c,
  volume: 1000,
}))

describe('ema', () => {
  it('returns empty array when not enough data', () => {
    expect(ema([1, 2, 3], 5)).toEqual([])
  })

  it('first value equals SMA of first period values', () => {
    const prices = [10, 20, 30, 40, 50]
    const result = ema(prices, 3)
    // First EMA = SMA of [10,20,30] = 20
    expect(result[0]).toBeCloseTo(20)
  })

  it('length equals prices.length - period + 1', () => {
    const result = ema(closes30, 20)
    expect(result.length).toBe(closes30.length - 20 + 1)
  })

  it('EMA rises in a rising price series', () => {
    const result = ema(closes30, 10)
    expect(result[result.length - 1]).toBeGreaterThan(result[0])
  })
})

describe('rsi', () => {
  it('returns empty when fewer than period+1 prices', () => {
    expect(rsi([1, 2, 3], 14)).toEqual([])
  })

  it('RSI is 100 when prices only go up', () => {
    const risingPrices = Array.from({ length: 20 }, (_, i) => i + 1)
    const result = rsi(risingPrices, 14)
    expect(result[0]).toBeCloseTo(100)
  })

  it('RSI is 0 when prices only go down', () => {
    const fallingPrices = Array.from({ length: 20 }, (_, i) => 20 - i)
    const result = rsi(fallingPrices, 14)
    expect(result[0]).toBeCloseTo(0)
  })

  it('RSI stays between 0 and 100', () => {
    const result = rsi(closes30, 14)
    result.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    })
  })
})

describe('atr', () => {
  it('returns empty when not enough candles', () => {
    expect(atr(candles30.slice(0, 5), 14)).toEqual([])
  })

  it('returns positive values', () => {
    const result = atr(candles30, 14)
    result.forEach(v => expect(v).toBeGreaterThan(0))
  })

  it('length is candles.length - period', () => {
    const result = atr(candles30, 14)
    expect(result.length).toBe(candles30.length - 14)
  })
})

describe('bollingerBands', () => {
  it('returns empty when not enough data', () => {
    expect(bollingerBands([1, 2, 3], 20)).toEqual([])
  })

  it('upper > middle > lower', () => {
    const result = bollingerBands(closes30, 20)
    result.forEach(b => {
      expect(b.upper).toBeGreaterThan(b.middle)
      expect(b.middle).toBeGreaterThan(b.lower)
    })
  })

  it('length equals closes.length - period + 1', () => {
    const result = bollingerBands(closes30, 20)
    expect(result.length).toBe(closes30.length - 20 + 1)
  })
})

describe('emaSlope', () => {
  it('returns 0 for single value', () => {
    expect(emaSlope([100])).toBe(0)
  })

  it('returns positive slope for rising EMA', () => {
    expect(emaSlope([100, 101])).toBeGreaterThan(0)
  })

  it('returns negative slope for falling EMA', () => {
    expect(emaSlope([101, 100])).toBeLessThan(0)
  })
})

describe('macd', () => {
  it('returns empty array when not enough data', () => {
    expect(macd(closes30.slice(0, 10))).toEqual([])
  })

  it('returns MACDResult objects with macd, signal, histogram', () => {
    const closes50 = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5)
    const result = macd(closes50)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('macd')
    expect(result[0]).toHaveProperty('signal')
    expect(result[0]).toHaveProperty('histogram')
  })

  it('histogram equals macd minus signal', () => {
    const closes50 = Array.from({ length: 50 }, (_, i) => 100 + i * 0.5)
    const result = macd(closes50)
    result.forEach(r => {
      expect(r.histogram).toBeCloseTo(r.macd - r.signal, 8)
    })
  })

  it('histogram is positive in a strong uptrend', () => {
    const closes50 = Array.from({ length: 50 }, (_, i) => 100 * Math.pow(1.02, i))
    const result = macd(closes50)
    expect(result[result.length - 1].histogram).toBeGreaterThan(0)
  })
})

describe('adx', () => {
  const candles50: CandleData[] = Array.from({ length: 50 }, (_, i) => {
    const c = 100 + i * 0.5
    return { time: i, open: c - 0.2, high: c + 1, low: c - 1, close: c, volume: 1000 }
  })

  it('returns empty array when not enough candles', () => {
    expect(adx(candles50.slice(0, 10))).toEqual([])
  })

  it('returns ADXResult objects with adx, plusDI, minusDI', () => {
    const result = adx(candles50)
    expect(result.length).toBeGreaterThan(0)
    expect(result[0]).toHaveProperty('adx')
    expect(result[0]).toHaveProperty('plusDI')
    expect(result[0]).toHaveProperty('minusDI')
  })

  it('ADX is between 0 and 100', () => {
    const result = adx(candles50)
    result.forEach(r => {
      expect(r.adx).toBeGreaterThanOrEqual(0)
      expect(r.adx).toBeLessThanOrEqual(100)
    })
  })

  it('ADX is higher in a strong trend than in a ranging market', () => {
    const trendCandles: CandleData[] = Array.from({ length: 50 }, (_, i) => {
      const c = 100 * Math.pow(1.01, i)
      return { time: i, open: c - 0.5, high: c + 2, low: c - 2, close: c, volume: 1000 }
    })
    const rangingCandles: CandleData[] = Array.from({ length: 50 }, (_, i) => {
      const c = 100 + Math.sin(i * 0.4) * 1.5
      return { time: i, open: c - 0.5, high: c + 2, low: c - 2, close: c, volume: 1000 }
    })
    const trendAdx = adx(trendCandles)
    const rangingAdx = adx(rangingCandles)
    const trendLast = trendAdx[trendAdx.length - 1].adx
    const rangingLast = rangingAdx[rangingAdx.length - 1].adx
    expect(trendLast).toBeGreaterThan(rangingLast)
  })
})
