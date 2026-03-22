'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { TrendingUp, Star } from 'lucide-react'
import { AssetRow } from '@/components/markets/asset-row'
import { Skeleton } from '@/components/ui/skeleton'
import { useWatchlist } from '@/hooks/use-watchlist'
import type { TrendingAsset } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type Tab = 'stocks' | 'crypto' | 'commodities' | 'gainers' | 'watchlist'

const TAB_LABELS: Record<Tab, string> = {
  stocks: 'Stocks',
  crypto: 'Crypto',
  commodities: 'Commodities',
  gainers: '🔥 Gainers',
  watchlist: '⭐ Watchlist',
}

export default function MarketsPage() {
  const [tab, setTab] = useState<Tab>('stocks')
  const { data, isLoading } = useSWR<{ stocks: TrendingAsset[]; crypto: TrendingAsset[]; commodities: TrendingAsset[] }>(
    '/api/market/trending',
    fetcher,
    { refreshInterval: 30000 }
  )
  const { watchlist, watchedSymbols, toggle } = useWatchlist()

  const allAssets = [...(data?.stocks ?? []), ...(data?.crypto ?? []), ...(data?.commodities ?? [])]
  const gainers = [...allAssets]
    .filter(a => a.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent)

  // For watchlist tab: match watchlist items against loaded assets, or show with price from quote
  const watchlistAssets: TrendingAsset[] = watchlist.map(w => {
    const found = allAssets.find(a => a.symbol === w.symbol)
    return found ?? { symbol: w.symbol, name: w.symbol, price: 0, changePercent: 0, assetType: w.assetType }
  })

  const assets =
    tab === 'stocks' ? (data?.stocks ?? []) :
    tab === 'crypto' ? (data?.crypto ?? []) :
    tab === 'commodities' ? (data?.commodities ?? []) :
    tab === 'gainers' ? gainers :
    watchlistAssets

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Markets</h1>
        <p className="text-text-muted text-sm mt-1">Live prices for stocks, crypto and commodities</p>
      </div>

      <div className="card overflow-hidden">
        <div className="flex border-b border-border overflow-x-auto">
          {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
                tab === t
                  ? 'text-brand border-brand'
                  : 'text-text-muted border-transparent hover:text-text-primary'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-2 border-b border-border">
          <span className="w-6" />
          <div className="flex items-center gap-3">
            <div className="w-9" />
            <span className="text-xs text-text-muted font-medium">Asset</span>
          </div>
          <span className="text-xs text-text-muted font-medium text-right w-32">Price / Change</span>
          <span className="w-8" />
        </div>

        {isLoading && tab !== 'watchlist' ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <div className="py-16 text-center text-text-muted text-sm">
            {tab === 'gainers' ? (
              <><TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-40" />No gainers found right now.</>
            ) : tab === 'watchlist' ? (
              <><Star className="w-8 h-8 mx-auto mb-3 opacity-40" />No symbols in your watchlist yet.<br />Star any asset to add it here.</>
            ) : (
              <><TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-40" />Failed to load market data.</>
            )}
          </div>
        ) : (
          assets.map((asset, i) => (
            <AssetRow
              key={asset.symbol}
              asset={asset}
              rank={tab !== 'watchlist' ? i + 1 : undefined}
              watched={watchedSymbols.has(asset.symbol)}
              onToggleWatch={() => toggle(asset.symbol, asset.assetType)}
            />
          ))
        )}
      </div>

      <p className="text-xs text-text-muted text-center">
        Prices refresh every 30 seconds. Stocks: Finnhub · Crypto: CoinGecko · Commodities: Yahoo Finance.
        Paper trading only — not financial advice.
      </p>
    </div>
  )
}
