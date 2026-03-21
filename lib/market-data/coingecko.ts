import type { Quote, CandleData, SearchResult, TrendingAsset } from '@/types'

const BASE_URL = 'https://api.coingecko.com/api/v3'

// Maps common ticker symbols to CoinGecko IDs
const SYMBOL_TO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  AVAX: 'avalanche-2',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  LINK: 'chainlink',
  UNI: 'uniswap',
  LTC: 'litecoin',
  ATOM: 'cosmos',
  FIL: 'filecoin',
  APT: 'aptos',
  ARB: 'arbitrum',
  OP: 'optimism',
  SUI: 'sui',
  INJ: 'injective-protocol',
}

async function request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const headers: Record<string, string> = {}
  if (process.env.COINGECKO_API_KEY) {
    headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY
  }

  const res = await fetch(url.toString(), { headers, next: { revalidate: 30 } })
  if (res.status === 429) throw new Error('CoinGecko rate limit exceeded')
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`)
  return res.json()
}

export function symbolToId(symbol: string): string {
  return SYMBOL_TO_ID[symbol.toUpperCase()] || symbol.toLowerCase()
}

export function idToSymbol(id: string): string {
  const entry = Object.entries(SYMBOL_TO_ID).find(([, v]) => v === id)
  return entry ? entry[0] : id.toUpperCase()
}

export async function getCryptoQuote(symbol: string): Promise<Quote> {
  const id = symbolToId(symbol)
  const data = await request<Record<string, {
    usd: number
    usd_24h_change: number
    usd_24h_vol: number
    usd_market_cap: number
  }>>('/simple/price', {
    ids: id,
    vs_currencies: 'usd',
    include_24hr_change: 'true',
    include_24hr_vol: 'true',
    include_market_cap: 'true',
  })

  const coin = data[id]
  if (!coin) throw new Error(`No data for ${symbol}`)

  const price = coin.usd
  const changePercent = coin.usd_24h_change || 0
  const change = (price / (1 + changePercent / 100)) * (changePercent / 100)

  return {
    symbol: symbol.toUpperCase(),
    name: symbol.toUpperCase(),
    price,
    change,
    changePercent,
    high: price * 1.01,
    low: price * 0.99,
    open: price - change,
    previousClose: price - change,
    volume: coin.usd_24h_vol || 0,
    marketCap: coin.usd_market_cap || 0,
    assetType: 'CRYPTO',
    timestamp: Date.now(),
  }
}

export async function getCryptoCandles(
  symbol: string,
  _resolution: string,
  from: number,
  to: number
): Promise<CandleData[]> {
  const id = symbolToId(symbol)
  const days = Math.ceil((to - from) / 86400)
  const data = await request<{ prices: [number, number][] }>(`/coins/${id}/market_chart`, {
    vs_currency: 'usd',
    days: String(Math.max(1, Math.min(days, 365))),
  })

  // Convert price data to OHLC-like candles (CoinGecko free tier doesn't provide true OHLC)
  return data.prices.map(([timestamp, price]) => ({
    time: Math.floor(timestamp / 1000),
    open: price,
    high: price,
    low: price,
    close: price,
  }))
}

export async function searchCrypto(query: string): Promise<SearchResult[]> {
  const data = await request<{ coins: Array<{ id: string; symbol: string; name: string; thumb: string }> }>('/search', {
    query,
  })

  return (data.coins || []).slice(0, 10).map(c => ({
    symbol: c.symbol.toUpperCase(),
    name: c.name,
    assetType: 'CRYPTO' as const,
    logoUrl: c.thumb,
  }))
}

export async function getTrendingCrypto(): Promise<TrendingAsset[]> {
  const data = await request<{
    data: Array<{
      id: string
      symbol: string
      name: string
      image: string
      current_price: number
      price_change_percentage_24h: number
    }>
  }>('/coins/markets', {
    vs_currency: 'usd',
    order: 'market_cap_desc',
    per_page: '10',
    page: '1',
    sparkline: 'false',
  })

  return (data.data || []).map(c => ({
    symbol: c.symbol.toUpperCase(),
    name: c.name,
    price: c.current_price,
    changePercent: c.price_change_percentage_24h || 0,
    assetType: 'CRYPTO' as const,
    logoUrl: c.image,
  }))
}
