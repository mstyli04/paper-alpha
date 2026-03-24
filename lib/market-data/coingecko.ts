import type { Quote, CandleData, SearchResult, TrendingAsset } from '@/types'

const BASE_URL = 'https://api.coingecko.com/api/v3'

// Curated high-precision overrides — these take priority over the dynamic map
// because some symbols are ambiguous (e.g. MATIC was renamed to POL but share a symbol).
const STATIC_OVERRIDES: Record<string, string> = {
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
  POL: 'matic-network',
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
  TAO: 'bittensor',
  SEI: 'sei-network',
  TIA: 'celestia',
  PYTH: 'pyth-network',
  JUP: 'jupiter-exchange-solana',
  WIF: 'dogwifcoin',
  BONK: 'bonk',
  PEPE: 'pepe',
  FET: 'fetch-ai',
  RENDER: 'render-token',
  RNDR: 'render-token',
  IMX: 'immutable-x',
  STRK: 'starknet',
  MANTA: 'manta-network',
  ZK: 'zksync',
  TRX: 'tron',
  TON: 'the-open-network',
  SHIB: 'shiba-inu',
  BCH: 'bitcoin-cash',
  NEAR: 'near',
  VET: 'vechain',
  ICP: 'internet-computer',
  HBAR: 'hedera-hashgraph',
  MKR: 'maker',
  AAVE: 'aave',
  SNX: 'havven',
  CRV: 'curve-dao-token',
  LDO: 'lido-dao',
  SAND: 'the-sandbox',
  MANA: 'decentraland',
  AXS: 'axie-infinity',
  RUNE: 'thorchain',
  ALGO: 'algorand',
  XLM: 'stellar',
  ETC: 'ethereum-classic',
  FLOW: 'flow',
  XMR: 'monero',
}

// ── Dynamic top-500 map ───────────────────────────────────────────────────────
let dynamicMapCache: Map<string, string> | null = null
let dynamicMapCachedAt = 0
const DYNAMIC_MAP_TTL = 60 * 60 * 1000 // 1 hour

async function getSymbolMap(): Promise<Map<string, string>> {
  if (dynamicMapCache && Date.now() - dynamicMapCachedAt < DYNAMIC_MAP_TTL) {
    return dynamicMapCache
  }

  const headers: Record<string, string> = {}
  if (process.env.COINGECKO_API_KEY) {
    headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY
  }

  const map = new Map<string, string>(Object.entries(STATIC_OVERRIDES))

  await Promise.allSettled(
    [1, 2].map(async (page) => {
      try {
        const res = await fetch(
          `${BASE_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&sparkline=false`,
          { headers, next: { revalidate: 3600 } }
        )
        if (!res.ok) return
        const coins: Array<{ id: string; symbol: string }> = await res.json()
        if (!Array.isArray(coins)) return
        for (const coin of coins) {
          const sym = coin.symbol.toUpperCase()
          if (!map.has(sym)) map.set(sym, coin.id)
        }
      } catch {
        // Silently skip — static overrides still work
      }
    })
  )

  dynamicMapCache = map
  dynamicMapCachedAt = Date.now()
  return map
}

// ── Exports ───────────────────────────────────────────────────────────────────

export async function symbolToId(symbol: string): Promise<string> {
  const map = await getSymbolMap()
  return map.get(symbol.toUpperCase()) ?? symbol.toLowerCase()
}

export async function getCryptoSymbols(): Promise<Set<string>> {
  const map = await getSymbolMap()
  return new Set(map.keys())
}

export function idToSymbol(id: string): string {
  const entry = Object.entries(STATIC_OVERRIDES).find(([, v]) => v === id)
  return entry ? entry[0] : id.toUpperCase()
}

// ── Internal request helper ───────────────────────────────────────────────────

async function request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const headers: Record<string, string> = {}
  if (process.env.COINGECKO_API_KEY) {
    headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY
  }

  // 30-second cache: prevents rate limit errors when multiple parts of the app
  // (markets, portfolio, trading engine) request the same price simultaneously.
  const res = await fetch(url.toString(), { headers, next: { revalidate: 30 } })
  if (res.status === 429) throw new Error('CoinGecko rate limit exceeded')
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`)
  return res.json()
}

// ── Quote & candle fetchers ───────────────────────────────────────────────────

const searchResolvedIds = new Map<string, string>()

async function resolveId(symbol: string): Promise<string> {
  const sym = symbol.toUpperCase()
  const mapId = await symbolToId(symbol)

  if (mapId !== sym.toLowerCase() || searchResolvedIds.has(sym)) {
    return searchResolvedIds.get(sym) ?? mapId
  }

  try {
    const result = await request<{ coins: Array<{ id: string; symbol: string }> }>('/search', { query: sym })
    const match = result.coins?.find(c => c.symbol.toUpperCase() === sym)
    if (match) {
      searchResolvedIds.set(sym, match.id)
      return match.id
    }
  } catch {
    // Fall through to the lowercased guess
  }

  return mapId
}

export async function getCryptoQuote(symbol: string): Promise<Quote> {
  const id = await resolveId(symbol)
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
  if (!coin) throw new Error(`No data for ${symbol} (resolved id: ${id})`)

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
  const id = await symbolToId(symbol)
  const days = Math.ceil((to - from) / 86400)
  const daysParam = days > 365 ? 'max' : String(Math.max(1, days))
  const data = await request<{ prices: [number, number][] }>(`/coins/${id}/market_chart`, {
    vs_currency: 'usd',
    days: daysParam,
  })

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
  const data = await request<Array<{
    id: string
    symbol: string
    name: string
    image: string
    current_price: number
    price_change_percentage_24h: number
  }>>('/coins/markets', {
    vs_currency: 'usd',
    order: 'market_cap_desc',
    per_page: '10',
    page: '1',
    sparkline: 'false',
  })

  return (Array.isArray(data) ? data : []).map(c => ({
    symbol: c.symbol.toUpperCase(),
    name: c.name,
    price: c.current_price,
    changePercent: c.price_change_percentage_24h || 0,
    assetType: 'CRYPTO' as const,
    logoUrl: c.image,
  }))
}
