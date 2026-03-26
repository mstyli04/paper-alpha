export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

interface RedditPost {
  data: {
    created_utc: number
    title: string
    score: number
    url: string
  }
}

export async function GET(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })

  // Sanitise symbol: only allow alphanumeric characters, hyphens, and dots
  if (!/^[a-zA-Z0-9\-.]+$/.test(symbol)) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 })
  }

  try {
    const subreddits = ['wallstreetbets', 'stocks', 'investing']
    const allPosts: RedditPost['data'][] = []

    await Promise.allSettled(
      subreddits.map(async (sub) => {
        const res = await fetch(
          `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(symbol)}&sort=new&limit=100&t=month&restrict_sr=1`,
          {
            headers: { 'User-Agent': 'PaperAlpha/1.0' },
            next: { revalidate: 3600 },
          }
        )
        if (!res.ok) return
        const data = await res.json()
        const posts = (data?.data?.children || []).map((c: RedditPost) => c.data)
        allPosts.push(...posts)
      })
    )

    // Bucket posts by day
    const dayCounts: Record<string, { count: number; totalScore: number }> = {}
    for (const post of allPosts) {
      const day = new Date(post.created_utc * 1000).toISOString().split('T')[0]
      if (!dayCounts[day]) dayCounts[day] = { count: 0, totalScore: 0 }
      dayCounts[day].count++
      dayCounts[day].totalScore += post.score
    }

    const activity = Object.entries(dayCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { count, totalScore }]) => ({
        date,
        mentions: count,
        score: totalScore,
      }))

    return NextResponse.json({ symbol, activity, total: allPosts.length })
  } catch {
    return NextResponse.json({ symbol, activity: [], total: 0 })
  }
}
