// __tests__/bot/indicators.test.ts
import { describe, it, expect } from 'vitest'
import { ema, rsi, atr, bollingerBands, emaSlope } from '@/lib/bot/indicators'
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
