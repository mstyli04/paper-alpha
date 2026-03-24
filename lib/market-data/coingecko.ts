import type { Quote, CandleData, SearchResult, TrendingAsset } from '@/types'

const BASE_URL = 'https://api.binance.com/api/v3'

const SYMBOL_NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', BNB: 'BNB', XRP: 'XRP',
  ADA: 'Cardano', AVAX: 'Avalanche', DOGE: 'Dogecoin', DOT: 'Polkadot',
  MATIC: 'Polygon', POL: 'Polygon', LINK: 'Chainlink', UNI: 'Uniswap',
  LTC: 'Litecoin', ATOM: 'Cosmos', FIL: 'Filecoin', APT: 'Aptos',
  ARB: 'Arbitrum', OP: 'Optimism', SUI: 'Sui', INJ: 'Injective',
  TAO: 'Bittensor', SEI: 'Sei', TIA: 'Celestia', JUP: 'Jupiter',
  WIF: 'dogwifhat', BONK: 'Bonk', PEPE: 'Pepe', FET: 'Fetch.ai',
  RENDER: 'Render', RNDR: 'Render', IMX: 'Immutable', TRX: 'Tron',
  TON: 'Toncoin', SHIB: 'Shiba Inu', BCH: 'Bitcoin Cash', NEAR: 'NEAR',
  VET: 'VeChain', ICP: 'Internet Computer', HBAR: 'Hedera', MKR: 'Maker',
  AAVE: 'Aave', CRV: 'Curve', LDO: 'Lido', SAND: 'The Sandbox',
  MANA: 'Decentraland', AXS: 'Axie Infinity', RUNE: 'THORChain',
  ALGO: 'Algorand', XLM: 'Stellar', ETC: 'Ethereum Classic', XMR: 'Monero',
}

// ── Symbol cache (from Binance exchange info) ─────────────────────────────────

let symbolsCache: Set<string> | null = null
let symbolsCachedAt = 0
const SYMBOLS_TTL = 60 * 60 * 1000 // 1 hour

async function fetchAllSymbols(): Promise<Set<string>> {
  if (symbolsCache && Date.now() - symbolsCachedAt < SYMBOLS_TTL) {
    return symbolsCache
  }

  try {
    const res = await fetch(`${BASE_URL}/exchangeInfo`, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error('failed')
    const data: { symbols: Array<{ baseAsset: string; quoteAsset: string; status: string }> } = await res.json()
    const set = new Set<string>()
    for (const s of data.symbols) {
      if (s.quoteAsset === 'USDT' && s.status === 'TRADING') {
        set.add(s.baseAsset.toUpperCase())
      }
    }
    symbolsCache = set
    symbolsCachedAt = Date.now()
    return set
  } catch {
    // Fall back to known list
    return new Set(Object.keys(SYMBOL_NAMES))
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toBinanceSymbol(symbol: string): string {
  return `${symbol.toUpperCase()}USDT`
}

async function request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { next: { revalidate: 30 } })
  if (!res.ok) throw new Error(`Binance error: ${res.status}`)
  return res.json()
}

// ── Exports ───────────────────────────────────────────────────────────────────

export async function symbolToId(symbol: string): Promise<string> {
  return symbol.toLowerCase()
}

export function idToSymbol(id: string): string {
  return id.toUpperCase()
}

export async function getCryptoSymbols(): Promise<Set<string>> {
  return fetchAllSymbols()
}

export async function getCryptoQuote(symbol: string): Promise<Quote> {
  const binanceSymbol = toBinanceSymbol(symbol)
  const data = await request<{
    lastPrice: string
    priceChange: string
    priceChangePercent: string
    highPrice: string
    lowPrice: string
    openPrice: string
    prevClosePrice: string
    quoteVolume: string
  }>('/ticker/24hr', { symbol: binanceSymbol })

  const price = parseFloat(data.lastPrice)
  const change = parseFloat(data.priceChange)
  const changePercent = parseFloat(data.priceChangePercent)

  return {
    symbol: symbol.toUpperCase(),
    name: SYMBOL_NAMES[symbol.toUpperCase()] || symbol.toUpperCase(),
    price,
    change,
    changePercent,
    high: parseFloat(data.highPrice),
    low: parseFloat(data.lowPrice),
    open: parseFloat(data.openPrice),
    previousClose: parseFloat(data.prevClosePrice),
    volume: parseFloat(data.quoteVolume),
    marketCap: 0,
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
  const binanceSymbol = toBinanceSymbol(symbol)
  const days = Math.ceil((to - from) / 86400)
  const interval = days <= 1 ? '1h' : days <= 7 ? '4h' : '1d'

  const data = await request<Array<[number, string, string, string, string]>>(
    '/klines',
    {
      symbol: binanceSymbol,
      interval,
      startTime: String(from * 1000),
      endTime: String(to * 1000),
      limit: '500',
    }
  )

  return data.map(([openTime, open, high, low, close]) => ({
    time: Math.floor(openTime / 1000),
    open: parseFloat(open),
    high: parseFloat(high),
    low: parseFloat(low),
    close: parseFloat(close),
  }))
}

export async function searchCrypto(query: string): Promise<SearchResult[]> {
  const q = query.toUpperCase()
  const allSymbols = await fetchAllSymbols()
  return Array.from(allSymbols)
    .filter(sym => sym.includes(q) || (SYMBOL_NAMES[sym] || '').toUpperCase().includes(q))
    .slice(0, 10)
    .map(sym => ({
      symbol: sym,
      name: SYMBOL_NAMES[sym] || sym,
      assetType: 'CRYPTO' as const,
    }))
}

export async function getTrendingCrypto(): Promise<TrendingAsset[]> {
  const topSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOGE', 'LINK', 'DOT']
  const binanceSymbols = JSON.stringify(topSymbols.map(toBinanceSymbol))

  const data = await request<Array<{
    symbol: string
    lastPrice: string
    priceChangePercent: string
  }>>('/ticker/24hr', { symbols: binanceSymbols })

  return data.map(item => {
    const sym = item.symbol.replace('USDT', '')
    return {
      symbol: sym,
      name: SYMBOL_NAMES[sym] || sym,
      price: parseFloat(item.lastPrice),
      changePercent: parseFloat(item.priceChangePercent),
      assetType: 'CRYPTO' as const,
    }
  })
}
