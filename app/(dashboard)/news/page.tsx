'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ExternalLink, Newspaper } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type Category = 'general' | 'crypto' | 'forex' | 'merger'

interface NewsItem {
  id: number | string
  headline: string
  summary: string
  source: string
  url: string
  image: string
  datetime: number
  related: string
  sentiment: 'positive' | 'negative' | 'neutral'
}

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'forex', label: 'Forex' },
  { id: 'merger', label: 'M&A' },
]

const sentimentStyles = {
  positive: 'bg-green/10 text-green border-green/20',
  negative: 'bg-red/10 text-red border-red/20',
  neutral: 'bg-text-muted/10 text-text-muted border-text-muted/20',
}

export default function NewsPage() {
  const [category, setCategory] = useState<Category>('general')

  const { data, isLoading } = useSWR<NewsItem[]>(
    `/api/market/news/general?category=${category}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  const sentimentCounts = data ? {
    positive: data.filter(n => n.sentiment === 'positive').length,
    negative: data.filter(n => n.sentiment === 'negative').length,
    neutral: data.filter(n => n.sentiment === 'neutral').length,
  } : null

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">Market News</h1>
          <p className="text-xs text-text-muted mt-0.5">Live financial news · Powered by Finnhub</p>
        </div>
        {sentimentCounts && (
          <div className="hidden sm:flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 text-green"><span className="w-1.5 h-1.5 rounded-full bg-green" />{sentimentCounts.positive} bullish</span>
            <span className="flex items-center gap-1 text-red"><span className="w-1.5 h-1.5 rounded-full bg-red" />{sentimentCounts.negative} bearish</span>
            <span className="flex items-center gap-1 text-text-muted"><span className="w-1.5 h-1.5 rounded-full bg-text-muted" />{sentimentCounts.neutral} neutral</span>
          </div>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              category === c.id
                ? 'bg-brand/10 text-brand border border-brand/30'
                : 'text-text-muted border border-border hover:text-text-primary hover:bg-surface-2'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* News grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))
        ) : !data?.length ? (
          <div className="col-span-2 py-24 text-center">
            <Newspaper className="w-8 h-8 mx-auto mb-3 text-text-muted opacity-40" />
            <p className="text-text-muted text-sm">No news available right now.</p>
          </div>
        ) : (
          data.map(item => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card p-4 flex gap-3 hover:bg-surface-2 transition-colors group"
            >
              {item.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-surface-2"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-medium text-text-primary leading-snug line-clamp-2 group-hover:text-brand transition-colors">
                    {item.headline}
                  </p>
                  <ExternalLink className="w-3.5 h-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
                </div>
                {item.summary && (
                  <p className="text-xs text-text-muted line-clamp-2 mb-2 leading-relaxed">{item.summary}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${sentimentStyles[item.sentiment]}`}>
                    {item.sentiment}
                  </span>
                  <span className="text-[10px] text-text-muted">{item.source}</span>
                  <span className="text-[10px] text-text-muted">{timeAgo(new Date(item.datetime * 1000))}</span>
                  {item.related && (
                    <span className="text-[10px] font-mono text-brand">{item.related}</span>
                  )}
                </div>
              </div>
            </a>
          ))
        )}
      </div>
    </div>
  )
}
