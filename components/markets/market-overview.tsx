'use client'

import useSWR from 'swr'
import { Skeleton } from '@/components/ui/skeleton'
import { pnlColor, formatPercent } from '@/lib/utils'
import { sectorColor } from '@/lib/market-data/overview'
import type { OverviewData, IndexData, SectorData, MoverData } from '@/lib/market-data/overview'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function IndicesBar({ indices }: { indices: IndexData[] }) {
  return (
    <div className="card p-4">
      <div className="flex flex-wrap gap-x-8 gap-y-2">
        {indices.map(idx => (
          <div key={idx.ticker} className="flex items-center gap-2">
            <span className="text-xs text-text-muted font-medium">{idx.label}</span>
            <span className="text-sm font-semibold text-text-primary">
              {idx.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
            <span className={`text-xs font-medium ${pnlColor(idx.changePercent)}`}>
              {formatPercent(idx.changePercent)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SectorHeatmap({ sectors }: { sectors: SectorData[] }) {
  return (
    <div className="card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">Sectors — Today</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {sectors.map(s => (
          <div
            key={s.ticker}
            className={`rounded-lg p-2 text-center ${sectorColor(s.changePercent)}`}
          >
            <div className="text-xs font-medium truncate">{s.name}</div>
            <div className="text-sm font-bold mt-0.5">{formatPercent(s.changePercent)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TopMovers({ movers }: { movers: { gainers: MoverData[]; losers: MoverData[] } }) {
  return (
    <div className="card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-text-primary">Top Movers</h3>
      <div>
        <div className="text-xs text-text-muted uppercase tracking-wide mb-1.5">Gainers</div>
        <div className="space-y-1.5">
          {movers.gainers.map(m => (
            <div key={m.symbol} className="flex justify-between items-center">
              <span className="text-sm font-medium text-text-primary">{m.symbol}</span>
              <span className="text-sm font-medium text-green">{formatPercent(m.changePercent)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-border" />
      <div>
        <div className="text-xs text-text-muted uppercase tracking-wide mb-1.5">Losers</div>
        <div className="space-y-1.5">
          {movers.losers.map(m => (
            <div key={m.symbol} className="flex justify-between items-center">
              <span className="text-sm font-medium text-text-primary">{m.symbol}</span>
              <span className="text-sm font-medium text-red">{formatPercent(m.changePercent)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MarketOverview() {
  const { data, isLoading } = useSWR<OverviewData>('/api/market/overview', fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-14 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-52 w-full" />
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-3">
      <IndicesBar indices={data.indices} />
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <SectorHeatmap sectors={data.sectors} />
        <TopMovers movers={data.movers} />
      </div>
    </div>
  )
}
