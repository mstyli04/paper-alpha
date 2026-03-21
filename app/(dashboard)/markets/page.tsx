'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { AssetRow } from '@/components/markets/asset-row'
import { Skeleton } from '@/components/ui/skeleton'
import type { TrendingAsset } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type Tab = 'stocks' | 'crypto'

export default function MarketsPage() {
  const [tab, setTab] = useState<Tab>('stocks')
  const { data, isLoading } = useSWR<{ stocks: TrendingAsset[]; crypto: TrendingAsset[] }>(
    '/api/market/trending',
    fetcher,
    { refreshInterval: 30000 }
  )

  const assets = tab === 'stocks' ? (data?.stocks ?? []) : (data?.crypto ?? [])

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Markets</h1>
        <p className="text-text-muted text-sm mt-1">Live prices for stocks and crypto</p>
      </div>

      <div className="card overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-border">
          {(['stocks', 'crypto'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'text-brand border-brand'
                  : 'text-text-muted border-transparent hover:text-text-primary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-2 border-b border-border">
          <span className="w-6" />
          <div className="flex items-center gap-3">
            <div className="w-9" />
            <span className="text-xs text-text-muted font-medium">Asset</span>
          </div>
          <span className="text-xs text-text-muted font-medium text-right w-32">Price / Change</span>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="py-16 text-center text-text-muted text-sm">
            Failed to load market data. Check your API keys.
          </div>
        ) : (
          assets.map((asset, i) => (
            <AssetRow key={asset.symbol} asset={asset} rank={i + 1} />
          ))
        )}
      </div>

      <p className="text-xs text-text-muted text-center">
        Prices refresh every 30 seconds. Data provided by Finnhub (stocks) and CoinGecko (crypto).
        Paper trading only — not financial advice.
      </p>
    </div>
  )
}
