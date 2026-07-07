export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

function scoreSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lower = text.toLowerCase()
  const pos = ['surge', 'soar', 'jump', 'gain', 'rise', 'beat', 'record', 'growth', 'profit', 'rally', 'boost', 'bullish', 'outperform', 'upgrade']
  const neg = ['drop', 'fall', 'plunge', 'loss', 'miss', 'decline', 'crash', 'bearish', 'downgrade', 'warn', 'risk', 'slump', 'tumble', 'concern']
  const posScore = pos.filter(w => lower.includes(w)).length
  const negScore = neg.filter(w => lower.includes(w)).length
  if (posScore > negScore) return 'positive'
  if (negScore > posScore) return 'negative'
  return 'neutral'
}

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') || 'general'

  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) return NextResponse.json([])

  try {
    const finnhubCategory = category === 'crypto' ? 'crypto' : category === 'forex' ? 'forex' : category === 'merger' ? 'merger' : 'general'

    const res = await fetch(
      `https://finnhub.io/api/v1/news?category=${finnhubCategory}&token=${apiKey}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return NextResponse.json([])

    const news = await res.json() as Array<{
      id: number
      headline: string
      summary: string
      source: string
      url: string
      image: string
      datetime: number
      category: string
      related: string
    }>

    const items = (news || []).slice(0, 30).map(item => ({
      id: item.id,
      headline: item.headline,
      summary: item.summary,
      source: item.source,
      url: item.url,
      image: item.image,
      datetime: item.datetime,
      category: item.category,
      related: item.related,
      sentiment: scoreSentiment(item.headline + ' ' + item.summary),
    }))

    return NextResponse.json(items)
  } catch {
    return NextResponse.json([])
  }
}
