import { describe, it, expect } from 'vitest'
import { sectorColor, pickMovers } from '@/lib/market-data/overview'
import type { MoverData } from '@/lib/market-data/overview'

describe('sectorColor', () => {
  it('returns white-on-green for strong gain (> +2%)', () => {
    expect(sectorColor(3)).toBe('bg-green text-white')
    expect(sectorColor(2.1)).toBe('bg-green text-white')
  })
  it('returns light green for moderate gain (+0.5% to +2%)', () => {
    expect(sectorColor(1)).toBe('bg-green/20 text-green')
    expect(sectorColor(0.5)).toBe('bg-green/20 text-green')
  })
  it('returns neutral for flat (-0.5% to +0.5%)', () => {
    expect(sectorColor(0)).toBe('bg-surface-2 text-text-muted')
    expect(sectorColor(0.4)).toBe('bg-surface-2 text-text-muted')
    expect(sectorColor(-0.4)).toBe('bg-surface-2 text-text-muted')
  })
  it('returns light red for moderate loss (-2% to -0.5%)', () => {
    expect(sectorColor(-1)).toBe('bg-red/20 text-red')
    expect(sectorColor(-0.6)).toBe('bg-red/20 text-red')
  })
  it('returns white-on-red for large loss (< -2%)', () => {
    expect(sectorColor(-3)).toBe('bg-red text-white')
    expect(sectorColor(-2.1)).toBe('bg-red text-white')
  })
})

describe('pickMovers', () => {
  const data: MoverData[] = [
    { symbol: 'A', price: 10, changePercent: 5.0 },
    { symbol: 'B', price: 20, changePercent: -3.0 },
    { symbol: 'C', price: 30, changePercent: 2.0 },
    { symbol: 'D', price: 40, changePercent: -1.0 },
    { symbol: 'E', price: 50, changePercent: 0.5 },
  ]

  it('returns top n gainers sorted descending', () => {
    const { gainers } = pickMovers(data, 3)
    expect(gainers.map(m => m.symbol)).toEqual(['A', 'C', 'E'])
  })

  it('returns top n losers sorted worst-first', () => {
    const { losers } = pickMovers(data, 2)
    expect(losers.map(m => m.symbol)).toEqual(['B', 'D'])
  })

  it('does not mutate the input array', () => {
    const copy = [...data]
    pickMovers(data, 3)
    expect(data).toEqual(copy)
  })

  it('handles n larger than array length gracefully', () => {
    const { gainers } = pickMovers(data, 10)
    expect(gainers.length).toBeLessThanOrEqual(data.length)
  })
})
