// lib/market-data/crypto-yahoo.ts
// Uses Yahoo Finance for crypto data — no API key, works on all servers.
// Falls back to CoinGecko simple/price for tokens Yahoo Finance misidentifies.
import type { Quote, CandleData } from '@/types'
import YahooFinance from 'yahoo-finance2'
import { symbolToId } from './coingecko'

const yf = new YahooFinance()

// Tokens Yahoo Finance maps to the wrong asset — skip Yahoo and use CoinGecko directly.
const YAHOO_BROKEN: Set<string> = new Set(['SUI', 'TON', 'STRK', 'ZK', 'MANTA'])

function toYahooSymbol(symbol: string): string {
  return `${symbol.toUpperCase()}-USD`
}

async function getCoinGeckoPrice(symbol: string): Promise<number> {
  try {
    const id = await symbolToId(symbol)
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
      { next: { revalidate: 120 } }
    )
    if (!res.ok) return 0
    const data = await res.json()
    return data?.[id]?.usd ?? 0
  } catch {
    return 0
  }
}

export async function getBinanceCryptoQuote(symbol: string): Promise<Quote> {
  const sym = symbol.toUpperCase()

  if (YAHOO_BROKEN.has(sym)) {
    const price = await getCoinGeckoPrice(sym)
    return {
      symbol,
      name: symbol,
      price,
      change: 0,
      changePercent: 0,
      high: price,
      low: price,
      open: price,
      previousClose: price,
      volume: 0,
      assetType: 'CRYPTO',
      timestamp: Date.now(),
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (yf as any).quote(toYahooSymbol(sym), {}, { validateResult: false })
  const price = result?.regularMarketPrice ?? 0
  const open = result?.regularMarketOpen ?? price

  // If Yahoo returns a suspiciously wrong name (not matching our symbol), fall back to CoinGecko price
  const name: string = result?.longName ?? result?.shortName ?? sym
  const nameMatchesSym = name.toLowerCase().includes(sym.toLowerCase()) ||
    sym.toLowerCase().includes(name.toLowerCase().split(' ')[0])
  const fallbackPrice = (!price || !nameMatchesSym) ? await getCoinGeckoPrice(sym) : 0

  return {
    symbol,
    name: nameMatchesSym ? name : symbol,
    price: fallbackPrice || price,
    change: result?.regularMarketChange ?? 0,
    changePercent: result?.regularMarketChangePercent ?? 0,
    high: result?.regularMarketDayHigh ?? (fallbackPrice || price),
    low: result?.regularMarketDayLow ?? (fallbackPrice || price),
    open,
    previousClose: result?.regularMarketPreviousClose ?? open,
    volume: result?.regularMarketVolume ?? 0,
    assetType: 'CRYPTO',
    timestamp: Date.now(),
  }
}

export async function getBinanceCryptoCandles(
  symbol: string,
  from: number,
  to: number
): Promise<CandleData[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (yf as any).chart(toYahooSymbol(symbol), {
    period1: new Date(from * 1000),
    period2: new Date(to * 1000),
    interval: '1d',
  }, { validateResult: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const quotes = (result as any)?.quotes ?? []
  return quotes
    .filter((q: { close: number | null }) => q.close !== null)
    .map((q: { date: Date; open: number; high: number; low: number; close: number; volume: number }) => ({
      time: Math.floor(new Date(q.date).getTime() / 1000),
      open: q.open ?? q.close,
      high: q.high ?? q.close,
      low: q.low ?? q.close,
      close: q.close,
      volume: q.volume ?? 0,
    }))
}
