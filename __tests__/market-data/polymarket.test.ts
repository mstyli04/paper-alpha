import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mapCLOBMarketToQuote, mapGammaMarketToTrendingAsset, mapPriceHistoryToCandles } from '@/lib/market-data/polymarket'

// --- mapCLOBMarketToQuote ---

const CLOB_MARKET = {
  condition_id: '0xabc123',
  question: 'Will Bitcoin reach $100k by end of 2025?',
  tokens: [
    { token_id: 'tok_yes', outcome: 'Yes', price: 0.65 },
    { token_id: 'tok_no', outcome: 'No', price: 0.35 },
  ],
  active: true,
  closed: false,
  end_date_iso: '2025-12-31T00:00:00Z',
  volume: '50000',
  volume_24hr: 1200,
}

describe('mapCLOBMarketToQuote', () => {
  it('maps YES token symbol to yesPrice', () => {
    const quote = mapCLOBMarketToQuote(CLOB_MARKET, '0xabc123:YES')
    expect(quote.price).toBe(0.65)
    expect(quote.yesPrice).toBe(0.65)
    expect(quote.noPrice).toBe(0.35)
    expect(quote.assetType).toBe('PREDICTION')
    expect(quote.conditionId).toBe('0xabc123')
  })

  it('maps NO token symbol to noPrice as the main price', () => {
    const quote = mapCLOBMarketToQuote(CLOB_MARKET, '0xabc123:NO')
    expect(quote.price).toBe(0.35)
  })

  it('defaults to YES price when no suffix', () => {
    const quote = mapCLOBMarketToQuote(CLOB_MARKET, '0xabc123')
    expect(quote.price).toBe(0.65)
  })

  it('sets question from market question', () => {
    const quote = mapCLOBMarketToQuote(CLOB_MARKET, '0xabc123')
    expect(quote.question).toBe('Will Bitcoin reach $100k by end of 2025?')
  })

  it('marks resolved when market is closed', () => {
    const closed = { ...CLOB_MARKET, closed: true, active: false }
    const quote = mapCLOBMarketToQuote(closed, '0xabc123')
    expect(quote.resolved).toBe(true)
  })

  it('sets resolvesAt from end_date_iso', () => {
    const quote = mapCLOBMarketToQuote(CLOB_MARKET, '0xabc123')
    expect(quote.resolvesAt).toBe(new Date('2025-12-31T00:00:00Z').getTime() / 1000)
  })

  it('truncates long question in name field', () => {
    const longQ = { ...CLOB_MARKET, question: 'A'.repeat(80) }
    const quote = mapCLOBMarketToQuote(longQ, '0xabc123')
    expect(quote.name.length).toBeLessThanOrEqual(63) // 60 chars + '...'
  })
})

// --- mapGammaMarketToTrendingAsset ---

const GAMMA_MARKET = {
  conditionId: '0xdef456',
  question: 'Will the Fed cut rates in Q1 2026?',
  outcomePrices: '["0.72","0.28"]',
  volume: '80000',
  volume24hr: 3000,
  tags: [{ id: 1, label: 'Politics', slug: 'politics' }],
  active: true,
  closed: false,
}

describe('mapGammaMarketToTrendingAsset', () => {
  it('maps conditionId to symbol', () => {
    const asset = mapGammaMarketToTrendingAsset(GAMMA_MARKET)
    expect(asset.symbol).toBe('0xdef456')
  })

  it('parses YES price from outcomePrices JSON', () => {
    const asset = mapGammaMarketToTrendingAsset(GAMMA_MARKET)
    expect(asset.price).toBe(0.72)
  })

  it('sets description from first tag label', () => {
    const asset = mapGammaMarketToTrendingAsset(GAMMA_MARKET)
    expect(asset.description).toBe('Politics')
  })

  it('falls back to Prediction when no tags', () => {
    const noTags = { ...GAMMA_MARKET, tags: [] }
    const asset = mapGammaMarketToTrendingAsset(noTags)
    expect(asset.description).toBe('Prediction')
  })

  it('sets assetType to PREDICTION', () => {
    const asset = mapGammaMarketToTrendingAsset(GAMMA_MARKET)
    expect(asset.assetType).toBe('PREDICTION')
  })
})

// --- mapPriceHistoryToCandles ---

describe('mapPriceHistoryToCandles', () => {
  const history = [
    { t: 1000, p: 0.60 },
    { t: 2000, p: 0.65 },
    { t: 3000, p: 0.70 },
    { t: 4000, p: 0.68 },
  ]

  it('maps each price point to a candle with O=H=L=C=p', () => {
    const candles = mapPriceHistoryToCandles(history, 0, 9999)
    expect(candles[0]).toEqual({ time: 1000, open: 0.60, high: 0.60, low: 0.60, close: 0.60, volume: 0 })
    expect(candles[1].close).toBe(0.65)
  })

  it('filters points outside from/to range', () => {
    const candles = mapPriceHistoryToCandles(history, 1500, 3500)
    expect(candles).toHaveLength(2)
    expect(candles[0].time).toBe(2000)
    expect(candles[1].time).toBe(3000)
  })

  it('returns empty array for empty history', () => {
    expect(mapPriceHistoryToCandles([], 0, 9999)).toEqual([])
  })
})
