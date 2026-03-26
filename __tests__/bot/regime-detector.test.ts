// __tests__/bot/regime-detector.test.ts
import { describe, it, expect } from 'vitest'
import { detectRegime } from '@/lib/bot/regime-detector'
import type { CandleData } from '@/types'

function makeCandles(closes: number[]): CandleData[] {
  return closes.map((c, i) => ({
    time: i,
    open: c - 0.5,
    high: c + 2,
    low: c - 2,
    close: c,
    volume: 1000,
  }))
}

// Strong uptrend: price climbs 1% per day
const trendingCloses = Array.from({ length: 50 }, (_, i) => 100 * Math.pow(1.01, i))

// Sideways market: price oscillates around 100
const rangingCloses = Array.from({ length: 50 }, (_, i) =>
  100 + Math.sin(i * 0.4) * 1.5
)

describe('detectRegime', () => {
  it('returns RANGING when fewer than 35 candles', () => {
    expect(detectRegime(makeCandles(trendingCloses.slice(0, 20)))).toBe('RANGING')
  })

  it('detects TRENDING in a strong uptrend', () => {
    expect(detectRegime(makeCandles(trendingCloses))).toBe('TRENDING')
  })

  it('detects RANGING in a sideways market', () => {
    expect(detectRegime(makeCandles(rangingCloses))).toBe('RANGING')
  })
})
