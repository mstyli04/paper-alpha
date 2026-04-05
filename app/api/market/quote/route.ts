export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getQuote } from '@/lib/market-data'
import { makeLimiter, checkRateLimit } from '@/lib/rate-limit'
import type { AssetType } from '@/types'

const limiter = makeLimiter(30, '1 m')

export async function GET(req: Request) {
  const { userId } = auth()
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
  const assetType = searchParams.get('assetType') as AssetType | null

  if (!symbol) return NextResponse.json({ error: 'symbol is required' }, { status: 400 })

  try {
    const quote = await getQuote(symbol, assetType ?? undefined)
    return NextResponse.json(quote)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch quote'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
