// lib/market-data/crypto-yahoo.ts
// Uses Yahoo Finance for crypto data — no API key, works on all servers.
import type { Quote, CandleData } from '@/types'
import YahooFinance from 'yahoo-finance2'

const yf = new YahooFinance()

function toYahooSymbol(symbol: string): string {
  return `${symbol.toUpperCase()}-USD`
}

export async function getBinanceCryptoQuote(symbol: string): Promise<Quote> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await (yf as any).quote(toYahooSymbol(symbol), {}, { validateResult: false })
  const price = result?.regularMarketPrice ?? 0
  const open = result?.regularMarketOpen ?? price
  return {
    symbol,
    name: result?.longName ?? result?.shortName ?? symbol,
    price,
    change: result?.regularMarketChange ?? 0,
    changePercent: result?.regularMarketChangePercent ?? 0,
    high: result?.regularMarketDayHigh ?? price,
    low: result?.regularMarketDayLow ?? price,
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
