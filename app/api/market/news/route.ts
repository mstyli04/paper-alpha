export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

interface FinnhubNewsItem {
  id: number
  headline: string
  summary: string
  source: string
  url: string
  image: string
  datetime: number
  category: string
  related: string
}

interface CoinGeckoNewsItem {
  title: string
  description: string
  news_site: string
  url: string
  thumb_2x: string
  updated_at: number
  slug: string
}

function scoreSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lower = text.toLowerCase()
  const positiveWords = ['surge', 'soar', 'jump', 'gain', 'rise', 'beat', 'record', 'growth', 'profit', 'up', 'high', 'strong', 'bullish', 'rally', 'boost', 'exceed', 'outperform', 'upgrade', 'buy', 'positive']
  const negativeWords = ['drop', 'fall', 'plunge', 'loss', 'miss', 'decline', 'down', 'low', 'weak', 'bearish', 'sell', 'cut', 'downgrade', 'risk', 'concern', 'warn', 'negative', 'slump', 'crash', 'tumble']
  const posScore = positiveWords.filter(w => lower.includes(w)).length
  const negScore = negativeWords.filter(w => lower.includes(w)).length
  if (posScore > negScore) return 'positive'
  if (negScore > posScore) return 'negative'
  return 'neutral'
}

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')
  const assetType = searchParams.get('assetType') || 'STOCK'

  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })

  try {
    if (assetType === 'CRYPTO') {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/news?per_page=10`,
        { next: { revalidate: 300 } }
      )
      if (!res.ok) return NextResponse.json([])
      const data = await res.json() as { data: CoinGeckoNewsItem[] }
      const items = (data.data || []).slice(0, 10).map((item: CoinGeckoNewsItem) => ({
        id: item.slug,
        headline: item.title,
        summary: item.description,
        source: item.news_site,
        url: item.url,
        image: item.thumb_2x,
        datetime: item.updated_at,
        sentiment: scoreSentiment(item.title + ' ' + item.description),
      }))
      return NextResponse.json(items)
    }

    // Stocks — Finnhub company news
    const apiKey = process.env.FINNHUB_API_KEY
    if (!apiKey) return NextResponse.json([])

    const to = Math.floor(Date.now() / 1000)
    const from = to - 7 * 86400 // last 7 days
    const toDate = new Date(to * 1000).toISOString().split('T')[0]
    const fromDate = new Date(from * 1000).toISOString().split('T')[0]

    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${apiKey}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return NextResponse.json([])

    const news = await res.json() as FinnhubNewsItem[]
    const items = (news || []).slice(0, 10).map((item: FinnhubNewsItem) => ({
      id: item.id,
      headline: item.headline,
      summary: item.summary,
      source: item.source,
      url: item.url,
      image: item.image,
      datetime: item.datetime,
      sentiment: scoreSentiment(item.headline + ' ' + item.summary),
    }))

    return NextResponse.json(items)
  } catch {
    return NextResponse.json([])
  }
}
