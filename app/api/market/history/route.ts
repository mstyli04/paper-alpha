export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getCandles } from '@/lib/market-data'
import type { AssetType } from '@/types'
import type { CandleResolution } from '@/lib/market-data/types'

export async function GET(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')
  const assetType = (searchParams.get('assetType') || 'STOCK') as AssetType
  const resolution = (searchParams.get('resolution') || 'D') as CandleResolution
  const range = searchParams.get('range') || '1M'

  if (!symbol) return NextResponse.json({ error: 'symbol is required' }, { status: 400 })

  const to = Math.floor(Date.now() / 1000)

  // Choose the finest resolution that keeps data density high without
  // blowing past API rate limits. For crypto, CoinGecko ignores the
  // resolution and auto-selects granularity from the days window:
  //   ≤1 day → minutely, 2–90 days → hourly, >90 days → daily.
  const rangeResolutionMap: Record<string, CandleResolution> = {
    '1D': '1',   // 1-min  — stocks ~390 pts, crypto minutely
    '1W': '60',  // 1-hour — stocks ~56 pts,  crypto ~168 pts (hourly)
    '1M': '60',  // 1-hour — stocks ~168 pts, crypto ~720 pts (hourly)
    '3M': 'D',   // daily  — stocks ~63 pts,  crypto ~90 pts (daily)
    '1Y': 'D',   // daily  — stocks ~252 pts, crypto ~365 pts
    '5Y': 'W',   // weekly — stocks ~260 pts, crypto uses 'max' (see coingecko.ts)
  }
  const resolvedResolution: CandleResolution = rangeResolutionMap[range] ?? resolution

  const rangeMap: Record<string, number> = {
    '1D': 86400,
    '1W': 604800,
    '1M': 2592000,
    '3M': 7776000,
    '1Y': 31536000,
    '5Y': 157680000,
  }
  const from = to - (rangeMap[range] || rangeMap['1M'])

  try {
    const candles = await getCandles(symbol, assetType, resolvedResolution, from, to)
    return NextResponse.json(candles)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
