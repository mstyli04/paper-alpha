import type { Quote, CandleData, SearchResult, TrendingAsset } from '@/types'

const BASE_URL = 'https://api.coincap.io/v2'

// Maps ticker symbols to CoinCap asset IDs
const SYMBOL_TO_ID: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binance-coin',
  XRP: 'xrp', ADA: 'cardano', AVAX: 'avalanche', DOGE: 'dogecoin',
  DOT: 'polkadot', MATIC: 'polygon', POL: 'polygon', LINK: 'chainlink',
  UNI: 'uniswap', LTC: 'litecoin', ATOM: 'cosmos', FIL: 'filecoin',
  APT: 'aptos', ARB: 'arbitrum', OP: 'optimism', SUI: 'sui',
  INJ: 'injective-protocol', TAO: 'bittensor', TRX: 'tron',
  TON: 'toncoin', SHIB: 'shiba-inu', BCH: 'bitcoin-cash', NEAR: 'near-protocol',
  VET: 'vechain', ICP: 'internet-computer', HBAR: 'hedera-hashgraph',
  MKR: 'maker', AAVE: 'aave', CRV: 'curve-dao-token', LDO: 'lido-dao',
  SAND: 'the-sandbox', MANA: 'decentraland', AXS: 'axie-infinity',
  RUNE: 'thorchain', ALGO: 'algorand', XLM: 'stellar',
  ETC: 'ethereum-classic', XMR: 'monero', PEPE: 'pepe',
  BONK: 'bonk', WIF: 'dogwifhat', RENDER: 'render-token', RNDR: 'render-token',
}

// ── Symbol cache ──────────────────────────────────────────────────────────────

let symbolsCache: Set<string> | null = null
let symbolsCachedAt = 0
const SYMBOLS_TTL = 60 * 60 * 1000

async function fetchAllSymbols(): Promise<Set<string>> {
  if (symbolsCache && Date.now() - symbolsCachedAt < SYMBOLS_TTL) {
    return symbolsCache
  }
  try {
    const res = await fetch(`${BASE_URL}/assets?limit=2000`, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error('failed')
    const data: { data: Array<{ symbol: string }> } = await res.json()
    const set = new Set(Object.keys(SYMBOL_TO_ID))
    for (const asset of data.data) set.add(asset.symbol.toUpperCase())
    symbolsCache = set
    symbolsCachedAt = Date.now()
    return set
  } catch {
    return new Set(Object.keys(SYMBOL_TO_ID))
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveId(symbol: string): Promise<string> {
  const upper = symbol.toUpperCase()
  if (SYMBOL_TO_ID[upper]) return SYMBOL_TO_ID[upper]
  // Fall back to search
  try {
    const res = await fetch(`${BASE_URL}/assets?search=${upper}&limit=5`, { cache: 'no-store' })
    if (!res.ok) throw new Error('failed')
    const data: { data: Array<{ id: string; symbol: string }> } = await res.json()
    const match = data.data.find(a => a.symbol.toUpperCase() === upper)
    if (match) return match.id
  } catch { /* fall through */ }
  return upper.toLowerCase()
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`CoinCap error: ${res.status}`)
  return res.json()
}

// ── Exports ───────────────────────────────────────────────────────────────────

export async function symbolToId(symbol: string): Promise<string> {
  return resolveId(symbol)
}

export function idToSymbol(id: string): string {
  const entry = Object.entries(SYMBOL_TO_ID).find(([, v]) => v === id)
  return entry ? entry[0] : id.toUpperCase()
}

export async function getCryptoSymbols(): Promise<Set<string>> {
  return fetchAllSymbols()
}

export async function getCryptoQuote(symbol: string): Promise<Quote> {
  const id = await resolveId(symbol)
  const data = await request<{
    data: {
      symbol: string
      name: string
      priceUsd: string
      changePercent24Hr: string
      volumeUsd24Hr: string
      marketCapUsd: string
    }
  }>(`/assets/${id}`)

  const price = parseFloat(data.data.priceUsd)
  const changePercent = parseFloat(data.data.changePercent24Hr) || 0
  const change = (price / (1 + changePercent / 100)) * (changePercent / 100)

  return {
    symbol: symbol.toUpperCase(),
    name: data.data.name,
    price,
    change,
    changePercent,
    high: price * 1.01,
    low: price * 0.99,
    open: price - change,
    previousClose: price - change,
    volume: parseFloat(data.data.volumeUsd24Hr) || 0,
    marketCap: parseFloat(data.data.marketCapUsd) || 0,
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
  const id = await resolveId(symbol)
  const days = Math.ceil((to - from) / 86400)
  const interval = days <= 1 ? 'h1' : days <= 7 ? 'h2' : 'd1'

  const data = await request<{
    data: Array<{ priceUsd: string; time: number }>
  }>(`/assets/${id}/history?interval=${interval}&start=${from * 1000}&end=${to * 1000}`)

  return data.data.map(({ time, priceUsd }) => {
    const price = parseFloat(priceUsd)
    return { time: Math.floor(time / 1000), open: price, high: price, low: price, close: price }
  })
}

export async function searchCrypto(query: string): Promise<SearchResult[]> {
  try {
    const data = await request<{
      data: Array<{ id: string; symbol: string; name: string }>
    }>(`/assets?search=${encodeURIComponent(query)}&limit=10`)
    return data.data.map(a => ({
      symbol: a.symbol.toUpperCase(),
      name: a.name,
      assetType: 'CRYPTO' as const,
    }))
  } catch {
    return []
  }
}

export async function getTrendingCrypto(): Promise<TrendingAsset[]> {
  try {
    const data = await request<{
      data: Array<{
        symbol: string
        name: string
        priceUsd: string
        changePercent24Hr: string
      }>
    }>('/assets?limit=10')
    return data.data.map(a => ({
      symbol: a.symbol.toUpperCase(),
      name: a.name,
      price: parseFloat(a.priceUsd),
      changePercent: parseFloat(a.changePercent24Hr) || 0,
      assetType: 'CRYPTO' as const,
    }))
  } catch {
    return []
  }
}
