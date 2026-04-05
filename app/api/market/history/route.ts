export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getCandles } from '@/lib/market-data'
import { makeLimiter, checkRateLimit } from '@/lib/rate-limit'
import type { AssetType } from '@/types'
import type { CandleResolution } from '@/lib/market-data/types'

const limiter = makeLimiter(30, '1 m')

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(limiter, userId)
  if (rl && !rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
    )
  }

  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')
  const assetType = (searchParams.get('assetType') || 'STOCK') as AssetType
  const resolution = (searchParams.get('resolution') || 'D') as CandleResolution
  const range = searchParams.get('range') || '1M'

  if (!symbol) return NextResponse.json({ error: 'symbol is required' }, { status: 400 })

  const to = Math.floor(Date.now() / 1000)

  const rangeResolutionMap: Record<string, CandleResolution> = {
    '1D': '1',
    '1W': '60',
    '1M': '60',
    '3M': 'D',
    '1Y': 'D',
    '5Y': 'W',
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
