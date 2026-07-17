'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { TrendingUp, Star } from 'lucide-react'
import { AssetRow } from '@/components/markets/asset-row'
import { Skeleton } from '@/components/ui/skeleton'
import { useWatchlist } from '@/hooks/use-watchlist'
import type { TrendingAsset } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type Tab = 'stocks' | 'crypto' | 'commodities' | 'predictions' | 'gainers' | 'watchlist'

const TAB_LABELS: Record<Tab, string> = {
  stocks: 'Stocks',
  crypto: 'Crypto',
  commodities: 'Commodities',
  predictions: 'Predictions',
  gainers: '🔥 Gainers',
  watchlist: '⭐ Watchlist',
}

const PREDICTION_CATEGORIES = ['All', 'Politics', 'Crypto', 'Sports', 'Business', 'News & Economy'] as const
type PredictionCategory = typeof PREDICTION_CATEGORIES[number]

export default function MarketsPage() {
  const [tab, setTab] = useState<Tab>('stocks')
  const [predCategory, setPredCategory] = useState<PredictionCategory>('All')
  const { data, isLoading } = useSWR<{
    stocks: TrendingAsset[]
    crypto: TrendingAsset[]
    commodities: TrendingAsset[]
    predictions: TrendingAsset[]
  }>(
    '/api/market/trending',
    fetcher,
    { refreshInterval: 30000 }
  )
  const { watchlist, watchedSymbols, toggle } = useWatchlist()

  const allAssets = [
    ...(data?.stocks ?? []),
    ...(data?.crypto ?? []),
    ...(data?.commodities ?? []),
  ]
  const gainers = [...allAssets]
    .filter(a => a.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent)

  const watchlistAssets: TrendingAsset[] = watchlist.map(w => {
    const found = allAssets.find(a => a.symbol === w.symbol)
    return found ?? { symbol: w.symbol, name: w.symbol, price: 0, changePercent: 0, assetType: w.assetType }
  })

  const allPredictions = data?.predictions ?? []
  const filteredPredictions = predCategory === 'All'
    ? allPredictions
    : allPredictions.filter(a => a.description?.toLowerCase() === predCategory.toLowerCase())

  const assets =
    tab === 'stocks' ? (data?.stocks ?? []) :
    tab === 'crypto' ? (data?.crypto ?? []) :
    tab === 'commodities' ? (data?.commodities ?? []) :
    tab === 'predictions' ? filteredPredictions :
    tab === 'gainers' ? gainers :
    watchlistAssets

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Markets</h1>
        <p className="text-text-muted text-sm mt-1">Live prices for stocks, crypto, commodities and prediction markets</p>
      </div>

      <div className="card overflow-hidden">
        <div className="flex border-b border-border overflow-x-auto">
          {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3.5 text-sm font-medium transition-colors border-b -mb-px whitespace-nowrap ${
                tab === t
                  ? 'text-brand border-brand'
                  : 'text-text-muted border-transparent hover:text-text-primary'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Category filter for predictions tab */}
        {tab === 'predictions' && (
          <div className="flex gap-2 px-4 py-2.5 border-b border-border overflow-x-auto">
            {PREDICTION_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setPredCategory(cat)}
                className={`px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors border ${
                  predCategory === cat
                    ? 'bg-surface-2 border-brand text-brand'
                    : 'text-text-muted border-border hover:text-text-primary'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-[1.5rem_2.25rem_minmax(0,1fr)_8rem_2rem] items-center gap-3 px-4 py-2 table-head">
          <span className="text-center">#</span>
          <span />
          <span>Asset</span>
          <span className="text-right">
            {tab === 'predictions' ? 'YES Price / Chg' : 'Price / Change'}
          </span>
          <span />
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
            ) : tab === 'predictions' ? (
              <><TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-40" />No prediction markets found.</>
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
        Prices refresh every 30 seconds. Stocks: Finnhub · Crypto: CoinGecko · Commodities: Yahoo Finance · Predictions: Polymarket.
        Paper trading only — not financial advice.
      </p>
    </div>
  )
}
