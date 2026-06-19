'use client'

import useSWR from 'swr'
import { ExternalLink } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/utils'
import type { AssetType } from '@/types'

interface NewsItem {
  id: string | number
  headline: string
  summary: string
  source: string
  url: string
  image?: string
  datetime: number
  sentiment: 'positive' | 'negative' | 'neutral'
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

const sentimentStyles = {
  positive: 'bg-green/10 text-green',
  negative: 'bg-red/10 text-red',
  neutral: 'bg-text-muted/10 text-text-muted',
}

const sentimentLabel = {
  positive: '↑ Bullish',
  negative: '↓ Bearish',
  neutral: '→ Neutral',
}

interface NewsFeedProps {
  symbol: string
  assetType: AssetType
}

export function NewsFeed({ symbol, assetType }: NewsFeedProps) {
  const { data: news, isLoading } = useSWR<NewsItem[]>(
    `/api/market/news?symbol=${symbol}&assetType=${assetType}`,
    fetcher,
    { refreshInterval: 300000 } // refresh every 5 minutes
  )

  // Sentiment summary
  const positive = news?.filter(n => n.sentiment === 'positive').length ?? 0
  const negative = news?.filter(n => n.sentiment === 'negative').length ?? 0
  const total = news?.length ?? 0
  const overallSentiment = total === 0 ? 'neutral' : positive > negative ? 'positive' : negative > positive ? 'negative' : 'neutral'

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">Latest News</h3>
        {total > 0 && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sentimentStyles[overallSentiment]}`}>
            {sentimentLabel[overallSentiment]}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : !news?.length ? (
        <div className="px-5 py-8 text-center text-text-muted text-sm">
          No recent news available
        </div>
      ) : (
        <div className="divide-y divide-border">
          {news.map(item => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 px-5 py-3.5 hover:bg-surface-2/50 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-text-primary group-hover:text-brand transition-colors line-clamp-2 leading-snug">
                    {item.headline}
                  </p>
                  <ExternalLink className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${sentimentStyles[item.sentiment]}`}>
                    {sentimentLabel[item.sentiment]}
                  </span>
                  <span className="text-xs text-text-muted">{item.source}</span>
                  <span className="text-xs text-text-muted">·</span>
                  <span className="text-xs text-text-muted">{timeAgo(new Date(item.datetime * 1000))}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
