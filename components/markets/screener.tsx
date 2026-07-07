'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatPercent, formatMarketCap, pnlColor } from '@/lib/utils'

interface ScreenerStock {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  marketCap?: number
  volume?: number
  sector: string
}

type SortKey = 'symbol' | 'price' | 'changePercent' | 'marketCap'
type SortDir = 'asc' | 'desc'

const SECTORS = ['All', 'Technology', 'Finance', 'Healthcare', 'Energy', 'Consumer', 'Industrials']

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function Screener() {
  const { data, isLoading } = useSWR<ScreenerStock[]>('/api/market/screener', fetcher, { revalidateOnFocus: false })
  const [sector, setSector] = useState('All')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('changePercent')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [direction, setDirection] = useState<'all' | 'up' | 'down'>('all')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filtered = useMemo(() => {
    if (!data) return []
    return data
      .filter(s => sector === 'All' || s.sector === sector)
      .filter(s => direction === 'all' || (direction === 'up' ? s.changePercent >= 0 : s.changePercent < 0))
      .filter(s => !search || s.symbol.includes(search.toUpperCase()) || s.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const av = a[sortKey] ?? 0
        const bv = b[sortKey] ?? 0
        return sortDir === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1)
      })
  }, [data, sector, direction, search, sortKey, sortDir])

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 text-text-muted" />
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-brand" />
      : <ArrowDown className="w-3 h-3 text-brand" />
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Stock Screener</h2>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-base pl-8 pr-3 py-1.5 text-xs w-32"
            />
          </div>

          {/* Direction filter */}
          <div className="flex border-2 border-border overflow-hidden text-xs">
            {(['all', 'up', 'down'] as const).map(d => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  direction === d ? 'bg-brand text-[#0a0a0a]' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {d === 'all' ? 'All' : d === 'up' ? '↑ Up' : '↓ Down'}
              </button>
            ))}
          </div>

          {/* Sector filter */}
          <div className="flex gap-1 flex-wrap">
            {SECTORS.map(s => (
              <button
                key={s}
                onClick={() => setSector(s)}
                className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors border-2 ${
                  sector === s
                    ? 'bg-surface-2 border-brand text-brand'
                    : 'text-text-muted border-border hover:text-text-primary'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-head">
              <th className="px-4 py-2.5 text-left">
                <button onClick={() => handleSort('symbol')} className="flex items-center gap-1 hover:text-text-primary">
                  Symbol <SortIcon k="symbol" />
                </button>
              </th>
              <th className="px-4 py-2.5 text-left hidden sm:table-cell">
                <span>Sector</span>
              </th>
              <th className="px-4 py-2.5 text-right">
                <button onClick={() => handleSort('price')} className="flex items-center gap-1 hover:text-text-primary ml-auto">
                  Price <SortIcon k="price" />
                </button>
              </th>
              <th className="px-4 py-2.5 text-right">
                <button onClick={() => handleSort('changePercent')} className="flex items-center gap-1 hover:text-text-primary ml-auto">
                  Change <SortIcon k="changePercent" />
                </button>
              </th>
              <th className="px-4 py-2.5 text-right hidden md:table-cell">
                <button onClick={() => handleSort('marketCap')} className="flex items-center gap-1 hover:text-text-primary ml-auto">
                  Mkt Cap <SortIcon k="marketCap" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20 ml-auto" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16 ml-auto" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-20 ml-auto" /></td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-text-muted text-sm">
                  No stocks match your filters.
                </td>
              </tr>
            ) : (
              filtered.map(stock => (
                <tr key={stock.symbol} className="table-row last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/markets/${stock.symbol}?type=STOCK`} className="hover:text-brand transition-colors">
                      <p className="font-medium text-text-primary">{stock.symbol}</p>
                      <p className="text-xs text-text-muted truncate max-w-[120px]">{stock.name}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs text-text-muted">{stock.sector}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-text-primary">
                    {formatCurrency(stock.price)}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium font-mono ${pnlColor(stock.changePercent)}`}>
                    {formatPercent(stock.changePercent)}
                  </td>
                  <td className="px-4 py-3 text-right text-text-muted hidden md:table-cell">
                    {stock.marketCap ? formatMarketCap(stock.marketCap) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
