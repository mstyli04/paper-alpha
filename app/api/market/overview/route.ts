export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getIndices, getSectors, getTopMovers } from '@/lib/market-data/overview'
import { makeLimiter, checkRateLimit } from '@/lib/rate-limit'

const limiter = makeLimiter(30, '1 m')

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(limiter, userId)
  if (rl && !rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
    )
  }

  const [indicesResult, sectorsResult, moversResult] = await Promise.allSettled([
    getIndices(),
    getSectors(),
    getTopMovers(),
  ])

  return NextResponse.json(
    {
      indices: indicesResult.status === 'fulfilled' ? indicesResult.value : [],
      sectors: sectorsResult.status === 'fulfilled' ? sectorsResult.value : [],
      movers:  moversResult.status === 'fulfilled'  ? moversResult.value  : { gainers: [], losers: [] },
    },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } }
  )
}
