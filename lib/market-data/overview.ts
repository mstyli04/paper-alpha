import YahooFinance from 'yahoo-finance2'
import { UNIVERSE } from '@/lib/bot/universe'

const yf = new YahooFinance()

const INDEX_LIST = [
  { label: 'S&P 500', ticker: '^GSPC' },
  { label: 'Nasdaq',  ticker: '^IXIC' },
  { label: 'Dow',     ticker: '^DJI'  },
  { label: 'Russell', ticker: '^RUT'  },
]

const SECTOR_LIST = [
  { name: 'Technology',       ticker: 'XLK'  },
  { name: 'Financials',       ticker: 'XLF'  },
  { name: 'Energy',           ticker: 'XLE'  },
  { name: 'Health Care',      ticker: 'XLV'  },
  { name: 'Industrials',      ticker: 'XLI'  },
  { name: 'Cons. Staples',    ticker: 'XLP'  },
  { name: 'Cons. Disc.',      ticker: 'XLY'  },
  { name: 'Real Estate',      ticker: 'XLRE' },
  { name: 'Materials',        ticker: 'XLB'  },
  { name: 'Utilities',        ticker: 'XLU'  },
  { name: 'Comm. Services',   ticker: 'XLC'  },
]

export interface IndexData {
  label: string
  ticker: string
  price: number
  change: number
  changePercent: number
}

export interface SectorData {
  name: string
  ticker: string
  changePercent: number
}

export interface MoverData {
  symbol: string
  price: number
  changePercent: number
}

export interface OverviewData {
  indices: IndexData[]
  sectors: SectorData[]
  movers: { gainers: MoverData[]; losers: MoverData[] }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchQuote(ticker: string): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (yf as any).quote(ticker, {}, { validateResult: false })
}

export function sectorColor(changePercent: number): string {
  if (changePercent > 2)     return 'bg-green text-white'
  if (changePercent >= 0.5)  return 'bg-green/20 text-green'
  if (changePercent >= -0.5) return 'bg-surface-2 text-text-muted'
  if (changePercent > -2)    return 'bg-red/20 text-red'
  return 'bg-red text-white'
}

export function pickMovers(
  movers: MoverData[],
  n: number
): { gainers: MoverData[]; losers: MoverData[] } {
  const sorted = [...movers].sort((a, b) => b.changePercent - a.changePercent)
  return {
    gainers: sorted.slice(0, n),
    losers: sorted.slice(Math.max(n, sorted.length - n)).reverse(),
  }
}

export async function getIndices(): Promise<IndexData[]> {
  const results = await Promise.allSettled(INDEX_LIST.map(({ ticker }) => fetchQuote(ticker)))
  return results.map((r, i) => ({
    label: INDEX_LIST[i].label,
    ticker: INDEX_LIST[i].ticker,
    price: r.status === 'fulfilled' ? (r.value?.regularMarketPrice ?? 0) : 0,
    change: r.status === 'fulfilled' ? (r.value?.regularMarketChange ?? 0) : 0,
    changePercent: r.status === 'fulfilled' ? (r.value?.regularMarketChangePercent ?? 0) : 0,
  }))
}

export async function getSectors(): Promise<SectorData[]> {
  const results = await Promise.allSettled(SECTOR_LIST.map(({ ticker }) => fetchQuote(ticker)))
  return results.map((r, i) => ({
    name: SECTOR_LIST[i].name,
    ticker: SECTOR_LIST[i].ticker,
    changePercent: r.status === 'fulfilled' ? (r.value?.regularMarketChangePercent ?? 0) : 0,
  }))
}

export async function getTopMovers(): Promise<{ gainers: MoverData[]; losers: MoverData[] }> {
  const stockSymbols = UNIVERSE.filter(a => a.assetType === 'STOCK').map(a => a.symbol)
  const results = await Promise.allSettled(stockSymbols.map(s => fetchQuote(s)))

  const movers: MoverData[] = results
    .map((r, i) => ({
      symbol: stockSymbols[i],
      price: r.status === 'fulfilled' ? (r.value?.regularMarketPrice ?? 0) : 0,
      changePercent: r.status === 'fulfilled' ? (r.value?.regularMarketChangePercent ?? 0) : 0,
    }))
    .filter(m => m.price > 0)

  return pickMovers(movers, 3)
}
