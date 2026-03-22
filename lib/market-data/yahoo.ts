import YahooFinance from 'yahoo-finance2'
import type { Quote, CandleData, TrendingAsset } from '@/types'

const yf = new YahooFinance()

// Yahoo Finance futures symbols for common commodities
export const COMMODITY_SYMBOLS: Record<string, string> = {
  'GC=F': 'Gold',
  'SI=F': 'Silver',
  'CL=F': 'Crude Oil (WTI)',
  'BZ=F': 'Crude Oil (Brent)',
  'NG=F': 'Natural Gas',
  'HG=F': 'Copper',
  'PL=F': 'Platinum',
  'PA=F': 'Palladium',
  'ZW=F': 'Wheat',
  'ZC=F': 'Corn',
  'ZS=F': 'Soybeans',
  'KC=F': 'Coffee',
  'CT=F': 'Cotton',
  'SB=F': 'Sugar',
}

export function isCommoditySymbol(symbol: string): boolean {
  return symbol.endsWith('=F')
}

export async function getCommodityQuote(symbol: string): Promise<Quote> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await (yf.quote as any)(symbol, {}, { validateResult: false }) as {
    regularMarketPrice: number
    regularMarketChange: number
    regularMarketChangePercent: number
    regularMarketOpen: number
    regularMarketDayHigh: number
    regularMarketDayLow: number
    regularMarketPreviousClose: number
    shortName?: string
    longName?: string
  }

  const name = COMMODITY_SYMBOLS[symbol] ?? data.shortName ?? data.longName ?? symbol

  return {
    symbol,
    name,
    price: data.regularMarketPrice ?? 0,
    change: data.regularMarketChange ?? 0,
    changePercent: data.regularMarketChangePercent ?? 0,
    open: data.regularMarketOpen ?? 0,
    high: data.regularMarketDayHigh ?? 0,
    low: data.regularMarketDayLow ?? 0,
    previousClose: data.regularMarketPreviousClose ?? 0,
    volume: 0,
    assetType: 'COMMODITY' as const,
    timestamp: Date.now(),
  }
}

export async function getCommodityCandles(
  symbol: string,
  from: number,
  to: number
): Promise<CandleData[]> {
  const result = await yf.chart(symbol, {
    period1: new Date(from * 1000),
    period2: new Date(to * 1000),
    interval: '1d',
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quotes = (result as any)?.quotes ?? []
  return quotes
    .filter((q: { close: number | null; date: Date }) => q.close !== null)
    .map((q: { close: number; open: number; high: number; low: number; volume: number; date: Date }) => ({
      time: Math.floor(new Date(q.date).getTime() / 1000),
      open: q.open ?? q.close,
      high: q.high ?? q.close,
      low: q.low ?? q.close,
      close: q.close,
      volume: q.volume ?? 0,
    }))
}

export async function getCommodityIntradayCandles(symbol: string): Promise<CandleData[]> {
  const result = await yf.chart(symbol, {
    period1: new Date(Date.now() - 2 * 86400 * 1000),
    period2: new Date(),
    interval: '1m',
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quotes = (result as any)?.quotes ?? []
  return quotes
    .filter((q: { close: number | null }) => q.close !== null)
    .map((q: { close: number; open: number; high: number; low: number; volume: number; date: Date }) => ({
      time: Math.floor(new Date(q.date).getTime() / 1000),
      open: q.open ?? q.close,
      high: q.high ?? q.close,
      low: q.low ?? q.close,
      close: q.close,
      volume: q.volume ?? 0,
    }))
}

export async function getStockCandlesYahoo(
  symbol: string,
  from: number,
  to: number,
  resolution: string
): Promise<CandleData[]> {
  const intervalMap: Record<string, '1m' | '5m' | '15m' | '1h' | '1d' | '1wk' | '1mo'> = {
    '1': '1m',
    '5': '5m',
    '15': '15m',
    '60': '1h',
    'D': '1d',
    'W': '1wk',
    'M': '1mo',
  }
  const interval = intervalMap[resolution] ?? '1d'

  const result = await yf.chart(symbol, {
    period1: new Date(from * 1000),
    period2: new Date(to * 1000),
    interval,
  }, { validateResult: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quotes = (result as any)?.quotes ?? []
  return quotes
    .filter((q: { close: number | null }) => q.close !== null)
    .map((q: { close: number; open: number; high: number; low: number; volume: number; date: Date }) => ({
      time: Math.floor(new Date(q.date).getTime() / 1000),
      open: q.open ?? q.close,
      high: q.high ?? q.close,
      low: q.low ?? q.close,
      close: q.close,
      volume: q.volume ?? 0,
    }))
}

export async function getTrendingCommodities(): Promise<TrendingAsset[]> {
  const symbols = Object.keys(COMMODITY_SYMBOLS).slice(0, 8)
  const results = await Promise.allSettled(symbols.map(s => getCommodityQuote(s)))

  return results
    .map((r, i) => {
      if (r.status !== 'fulfilled') return null
      const q = r.value
      return {
        symbol: symbols[i],
        name: q.name,
        price: q.price,
        changePercent: q.changePercent,
        assetType: 'COMMODITY' as const,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null) as TrendingAsset[]
}
