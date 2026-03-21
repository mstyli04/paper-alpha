import type { Quote, CandleData, SearchResult, TrendingAsset } from '@/types'
import type { CandleResolution } from './types'
import { getStockQuote, getStockCandles, searchStocks, getTrendingStocks } from './finnhub'
import { getCryptoQuote, getCryptoCandles, searchCrypto, getTrendingCrypto } from './coingecko'

// Well-known crypto symbols for routing decisions
const CRYPTO_SYMBOLS = new Set([
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOGE', 'DOT',
  'MATIC', 'LINK', 'UNI', 'LTC', 'ATOM', 'FIL', 'APT', 'ARB', 'OP', 'SUI', 'INJ',
])

export function isCrypto(symbol: string): boolean {
  return CRYPTO_SYMBOLS.has(symbol.toUpperCase())
}

export async function getQuote(symbol: string, assetType?: 'STOCK' | 'CRYPTO'): Promise<Quote> {
  const type = assetType ?? (isCrypto(symbol) ? 'CRYPTO' : 'STOCK')
  if (type === 'CRYPTO') return getCryptoQuote(symbol)
  return getStockQuote(symbol)
}

export async function getCandles(
  symbol: string,
  assetType: 'STOCK' | 'CRYPTO',
  resolution: CandleResolution,
  from: number,
  to: number
): Promise<CandleData[]> {
  if (assetType === 'CRYPTO') return getCryptoCandles(symbol, resolution, from, to)
  return getStockCandles(symbol, resolution, from, to)
}

export async function search(query: string): Promise<SearchResult[]> {
  const [stocks, crypto] = await Promise.allSettled([searchStocks(query), searchCrypto(query)])
  const results: SearchResult[] = []
  if (stocks.status === 'fulfilled') results.push(...stocks.value)
  if (crypto.status === 'fulfilled') results.push(...crypto.value)
  return results.slice(0, 20)
}

export async function getTrending(): Promise<{ stocks: TrendingAsset[]; crypto: TrendingAsset[] }> {
  const [stocks, crypto] = await Promise.allSettled([getTrendingStocks(), getTrendingCrypto()])
  return {
    stocks: stocks.status === 'fulfilled' ? stocks.value : [],
    crypto: crypto.status === 'fulfilled' ? crypto.value : [],
  }
}
