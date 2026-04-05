import type { Quote, CandleData, SearchResult, TrendingAsset } from '@/types'
import type { CandleResolution } from './types'
import { getStockQuote, getStockCandles, searchStocks, getTrendingStocks } from './finnhub'
import { searchCrypto, getTrendingCrypto, getCryptoSymbols } from './coingecko'
import { getBinanceCryptoQuote, getBinanceCryptoCandles } from './binance'
import {
  getCommodityQuote,
  getCommodityCandles,
  getCommodityIntradayCandles,
  getTrendingCommodities,
  isCommoditySymbol,
  getStockCandlesYahoo,
} from './yahoo'
import {
  getPolymarketQuote,
  getPolymarketCandles,
  getTrendingPredictions,
  searchPredictions,
} from './polymarket'

export async function isCrypto(symbol: string): Promise<boolean> {
  const symbols = await getCryptoSymbols()
  return symbols.has(symbol.toUpperCase())
}

export async function getQuote(symbol: string, assetType?: 'STOCK' | 'CRYPTO' | 'COMMODITY' | 'PREDICTION'): Promise<Quote> {
  if (assetType === 'PREDICTION') return getPolymarketQuote(symbol)
  if (assetType === 'COMMODITY' || isCommoditySymbol(symbol)) return getCommodityQuote(symbol)
  const type = assetType ?? ((await isCrypto(symbol)) ? 'CRYPTO' : 'STOCK')
  if (type === 'CRYPTO') return getBinanceCryptoQuote(symbol)
  return getStockQuote(symbol)
}

export async function getCandles(
  symbol: string,
  assetType: 'STOCK' | 'CRYPTO' | 'COMMODITY' | 'PREDICTION',
  resolution: CandleResolution,
  from: number,
  to: number
): Promise<CandleData[]> {
  if (assetType === 'PREDICTION') return getPolymarketCandles(symbol, from, to)
  if (assetType === 'COMMODITY') {
    if (resolution === '1') return getCommodityIntradayCandles(symbol)
    return getCommodityCandles(symbol, from, to)
  }
  if (assetType === 'CRYPTO') return getBinanceCryptoCandles(symbol, from, to)
  let candles: CandleData[] = []
  try {
    candles = await getStockCandles(symbol, resolution, from, to)
  } catch { /* Finnhub unavailable on free tier — fall through to Yahoo */ }
  if (candles.length > 0) return candles
  return getStockCandlesYahoo(symbol, from, to, resolution)
}

export async function search(query: string): Promise<SearchResult[]> {
  const [stocks, crypto, predictions] = await Promise.allSettled([
    searchStocks(query),
    searchCrypto(query),
    searchPredictions(query),
  ])
  const results: SearchResult[] = []
  if (stocks.status === 'fulfilled') results.push(...stocks.value)
  if (crypto.status === 'fulfilled') results.push(...crypto.value)
  if (predictions.status === 'fulfilled') results.push(...predictions.value)
  return results.slice(0, 20)
}

export async function getTrending(): Promise<{
  stocks: TrendingAsset[]
  crypto: TrendingAsset[]
  commodities: TrendingAsset[]
  predictions: TrendingAsset[]
}> {
  const [stocks, crypto, commodities, predictions] = await Promise.allSettled([
    getTrendingStocks(),
    getTrendingCrypto(),
    getTrendingCommodities(),
    getTrendingPredictions(),
  ])
  return {
    stocks: stocks.status === 'fulfilled' ? stocks.value : [],
    crypto: crypto.status === 'fulfilled' ? crypto.value : [],
    commodities: commodities.status === 'fulfilled' ? commodities.value : [],
    predictions: predictions.status === 'fulfilled' ? predictions.value : [],
  }
}
