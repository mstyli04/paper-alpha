'use client'

import useSWR from 'swr'
import { Skeleton } from '@/components/ui/skeleton'

interface RedditDay {
  date: string
  mentions: number
  score: number
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function RedditActivity({ symbol }: { symbol: string }) {
  const { data, isLoading } = useSWR<{ activity: RedditDay[]; total: number }>(
    `/api/market/reddit?symbol=${symbol}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  const activity = data?.activity ?? []
  const maxMentions = Math.max(...activity.map(d => d.mentions), 1)

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Reddit Activity</h3>
          <p className="text-xs text-text-muted mt-0.5">r/wallstreetbets · r/stocks · r/investing</p>
        </div>
        {data && (
          <span className="text-xs text-text-muted bg-surface-2 border border-border px-2 py-1 rounded-full">
            {data.total} mentions (30d)
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
        </div>
      ) : activity.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-4">No recent Reddit activity found</p>
      ) : (
        <div className="space-y-1.5">
          {activity.slice(-14).map(day => (
            <div key={day.date} className="flex items-center gap-3">
              <span className="text-xs text-text-muted w-20 flex-shrink-0">
                {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <div className="flex-1 h-5 bg-surface-2 overflow-hidden">
                <div
                  className="h-full bg-brand/70 transition-all"
                  style={{ width: `${(day.mentions / maxMentions) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-text-secondary w-8 text-right flex-shrink-0">
                {day.mentions}
              </span>
            </div>
          ))}
          <p className="text-xs text-text-muted mt-2">
            Bar height = mention count. Score = total upvotes across all posts that day.
          </p>
        </div>
      )}
    </div>
  )
}
