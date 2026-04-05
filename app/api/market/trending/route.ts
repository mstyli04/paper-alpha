export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getTrending } from '@/lib/market-data'

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await getTrending()
    return NextResponse.json(data, { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' } })
  } catch {
    return NextResponse.json(
      { stocks: [], crypto: [], commodities: [], predictions: [] },
      { headers: { 'Cache-Control': 's-maxage=120, stale-while-revalidate=300' } }
    )
  }
}
