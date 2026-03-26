import { describe, it, expect } from 'vitest'
import { calculatePositionSize } from '@/lib/bot/position-sizer'

describe('calculatePositionSize', () => {
  it('returns 0 when price is 0', () => {
    expect(calculatePositionSize({ portfolioValue: 100000, price: 0, conviction: 1, assetType: 'STOCK' })).toBe(0)
  })

  it('returns 0 when conviction is 0', () => {
    expect(calculatePositionSize({ portfolioValue: 100000, price: 100, conviction: 0, assetType: 'STOCK' })).toBe(0)
  })

  it('never exceeds 5% of portfolio value', () => {
    const result = calculatePositionSize({ portfolioValue: 100000, price: 10, conviction: 1, assetType: 'STOCK' })
    expect(result * 10).toBeLessThanOrEqual(100000 * 0.05)
  })

  it('scales with conviction — higher conviction produces more shares', () => {
    const low  = calculatePositionSize({ portfolioValue: 100000, price: 100, conviction: 0.2, assetType: 'STOCK' })
    const high = calculatePositionSize({ portfolioValue: 100000, price: 100, conviction: 0.9, assetType: 'STOCK' })
    expect(high).toBeGreaterThan(low)
  })

  it('returns whole shares for STOCK', () => {
    const result = calculatePositionSize({ portfolioValue: 100000, price: 150, conviction: 0.8, assetType: 'STOCK' })
    expect(result).toBe(Math.floor(result))
  })

  it('returns fractional quantity for CRYPTO', () => {
    const result = calculatePositionSize({ portfolioValue: 100000, price: 60000, conviction: 0.8, assetType: 'CRYPTO' })
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(1)
  })

  it('uses custom win rate and odds when provided', () => {
    const conservative = calculatePositionSize({ portfolioValue: 100000, price: 100, conviction: 1, assetType: 'STOCK', winRate: 0.4, avgWinLossRatio: 1.0 })
    const aggressive   = calculatePositionSize({ portfolioValue: 100000, price: 100, conviction: 1, assetType: 'STOCK', winRate: 0.7, avgWinLossRatio: 2.0 })
    expect(aggressive).toBeGreaterThan(conservative)
  })
})
