'use client'

import useSWR from 'swr'
import type { AssetType } from '@/types'

interface WatchlistItem {
  id: string
  symbol: string
  assetType: AssetType
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useWatchlist() {
  const { data, mutate, isLoading } = useSWR<WatchlistItem[]>('/api/watchlist', fetcher)

  const watchedSymbols = new Set(data?.map(w => w.symbol) ?? [])

  async function toggle(symbol: string, assetType: AssetType) {
    const sym = symbol.toUpperCase()
    if (watchedSymbols.has(sym)) {
      await fetch(`/api/watchlist?symbol=${sym}`, { method: 'DELETE' })
    } else {
      await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym, assetType }),
      })
    }
    mutate()
  }

  return { watchlist: data ?? [], watchedSymbols, toggle, isLoading }
}
