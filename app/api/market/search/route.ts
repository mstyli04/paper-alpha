import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { search } from '@/lib/market-data'

export async function GET(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')

  if (!query || query.length < 1) return NextResponse.json([])

  try {
    const results = await search(query)
    return NextResponse.json(results)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
