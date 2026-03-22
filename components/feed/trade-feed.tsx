'use client'

import useSWR from 'swr'
import Link from 'next/link'
import Image from 'next/image'
import { Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, timeAgo } from '@/lib/utils'
import type { AssetType } from '@/types'

interface FeedTrade {
  id: string
  symbol: string
  assetType: AssetType
  assetName: string
  side: 'BUY' | 'SELL' | 'SHORT' | 'COVER'
  quantity: number
  price: number
  totalValue: number
  createdAt: string
  username: string
  avatarUrl: string | null
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

const sideStyles: Record<string, string> = {
  BUY:   'bg-green/10 text-green',
  SELL:  'bg-red/10 text-red',
  SHORT: 'bg-orange-500/10 text-orange-500',
  COVER: 'bg-blue-500/10 text-blue-500',
}

export function TradeFeed() {
  const { data, isLoading } = useSWR<FeedTrade[]>('/api/feed', fetcher, {
    refreshInterval: 30000,
  })

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <Users className="w-4 h-4 text-brand" />
        <h2 className="text-sm font-semibold text-text-primary">Live Trade Feed</h2>
        <span className="text-xs text-text-muted ml-auto">All traders</span>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      ) : !data?.length ? (
        <div className="px-5 py-10 text-center text-text-muted text-sm">
          No trades yet. Be the first!
        </div>
      ) : (
        <div className="divide-y divide-border">
          {data.map(trade => (
            <div key={trade.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-surface-2 border border-border overflow-hidden flex-shrink-0 flex items-center justify-center">
                {trade.avatarUrl ? (
                  <Image src={trade.avatarUrl} alt={trade.username} width={32} height={32} className="object-cover" />
                ) : (
                  <span className="text-xs font-bold text-text-secondary">
                    {trade.username.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Link
                    href={`/profile/${trade.username}`}
                    className="text-sm font-medium text-text-primary hover:text-brand transition-colors"
                    onClick={e => e.stopPropagation()}
                  >
                    {trade.username}
                  </Link>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${sideStyles[trade.side]}`}>
                    {trade.side}
                  </span>
                  <Link
                    href={`/markets/${trade.symbol}?type=${trade.assetType}`}
                    className="text-sm font-medium text-text-primary hover:text-brand transition-colors"
                    onClick={e => e.stopPropagation()}
                  >
                    {trade.symbol}
                  </Link>
                </div>
                <p className="text-xs text-text-muted">
                  {trade.quantity} shares · {formatCurrency(trade.price)} · {timeAgo(new Date(trade.createdAt))}
                </p>
              </div>

              {/* Value */}
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-mono font-medium text-text-primary">
                  {formatCurrency(trade.totalValue)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
