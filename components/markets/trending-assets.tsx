'use client'

import useSWR from 'swr'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, pnlColor, formatPercent } from '@/lib/utils'
import type { TrendingAsset } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface TrendingData {
  stocks:      TrendingAsset[]
  crypto:      TrendingAsset[]
  commodities: TrendingAsset[]
}

function TrendingColumn({ title, items }: { title: string; items: TrendingAsset[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">{title}</h4>
      <div className="space-y-2.5">
        {items.slice(0, 5).map(item => (
          <div key={item.symbol} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{item.symbol}</p>
              <p className="text-xs text-text-muted truncate">{item.name}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-mono text-text-primary">{formatCurrency(item.price)}</p>
              <p className={`text-xs font-medium ${pnlColor(item.changePercent)}`}>
                {formatPercent(item.changePercent)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TrendingAssets() {
  const { data, isLoading } = useSWR<TrendingData>(
    '/api/market/trending',
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 120_000 }
  )

  const isEmpty = !data || (
    data.stocks.length === 0 &&
    data.crypto.length === 0 &&
    data.commodities.length === 0
  )

  if (!isLoading && isEmpty) return null

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-4">Trending</h3>
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-9 w-full" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <TrendingColumn title="Stocks"      items={data!.stocks} />
          <TrendingColumn title="Crypto"      items={data!.crypto} />
          <TrendingColumn title="Commodities" items={data!.commodities} />
        </div>
      )}
    </div>
  )
}
