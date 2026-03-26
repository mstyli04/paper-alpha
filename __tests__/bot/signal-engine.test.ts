// __tests__/bot/signal-engine.test.ts
import { describe, it, expect } from 'vitest'
import { generateSignal } from '@/lib/bot/signal-engine'
import type { CandleData } from '@/types'

function makeCandles(closes: number[], highLowSpread = 2): CandleData[] {
  return closes.map((c, i) => ({
    time: i,
    open: c - 0.2,
    high: c + highLowSpread,
    low: c - highLowSpread,
    close: c,
    volume: 1000,
  }))
}

// Strong uptrend (1% per bar) — should trigger TRENDING regime
const trendingCloses = Array.from({ length: 50 }, (_, i) => 100 * Math.pow(1.01, i))

// Sideways — should trigger RANGING regime
const rangingCloses = Array.from({ length: 50 }, (_, i) => 100 + Math.sin(i * 0.4) * 1.5)

// Price below lower BB: stable prices then a sharp drop
const oversoldCloses = [
  ...Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i * 0.3) * 0.5),
  ...Array.from({ length: 10 }, (_, i) => 100 - i * 3),
]

describe('generateSignal', () => {
  it('returns a signal object with required fields', () => {
    const signal = generateSignal('AAPL', makeCandles(trendingCloses), false)
    expect(signal).toHaveProperty('symbol', 'AAPL')
    expect(signal).toHaveProperty('action')
    expect(signal).toHaveProperty('conviction')
    expect(signal).toHaveProperty('strategy')
    expect(signal).toHaveProperty('regime')
  })

  it('conviction is between 0 and 1', () => {
    const signal = generateSignal('AAPL', makeCandles(trendingCloses), false)
    expect(signal.conviction).toBeGreaterThanOrEqual(0)
    expect(signal.conviction).toBeLessThanOrEqual(1)
  })

  it('returns a valid action for held trending position', () => {
    const held = generateSignal('AAPL', makeCandles(trendingCloses), true)
    expect(['BUY', 'SELL', 'HOLD']).toContain(held.action)
  })

  it('returns RANGING regime signal for sideways prices', () => {
    const signal = generateSignal('BTC', makeCandles(rangingCloses), false)
    expect(signal.regime).toBe('RANGING')
    expect(signal.strategy).toBe('MEAN_REVERSION')
  })

  it('returns TRENDING regime signal for trending prices', () => {
    const signal = generateSignal('AAPL', makeCandles(trendingCloses), false)
    expect(signal.regime).toBe('TRENDING')
    expect(signal.strategy).toBe('MOMENTUM')
  })

  it('oversold ranging regime returns MEAN_REVERSION strategy', () => {
    const signal = generateSignal('BTC', makeCandles(oversoldCloses, 0.1), false)
    expect(signal.strategy).toBe('MEAN_REVERSION')
    if (signal.action === 'BUY') {
      expect(signal.conviction).toBeGreaterThan(0)
    }
  })
})
