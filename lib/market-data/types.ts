import type { Quote, CandleData, SearchResult, TrendingAsset } from '@/types'

export interface MarketDataProvider {
  getQuote(symbol: string): Promise<Quote>
  getCandles(symbol: string, resolution: CandleResolution, from: number, to: number): Promise<CandleData[]>
  search(query: string): Promise<SearchResult[]>
  getTrending(): Promise<TrendingAsset[]>
}

export type CandleResolution = '1' | '5' | '15' | '30' | '60' | 'D' | 'W' | 'M'
