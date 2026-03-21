import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getTrending } from '@/lib/market-data'

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await getTrending()
    return NextResponse.json(data, { headers: { 'Cache-Control': 's-maxage=30' } })
  } catch {
    return NextResponse.json({ stocks: [], crypto: [] })
  }
}
