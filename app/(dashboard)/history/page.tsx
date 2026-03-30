'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, FileText } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatQuantity, timeAgo } from '@/lib/utils'
import type { TradeRecord, TradeSide } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function HistoryPage() {
  const [page, setPage] = useState(1)
  const [sideFilter, setSideFilter] = useState<TradeSide | ''>('')

  const params = new URLSearchParams({ page: String(page), limit: '25' })
  if (sideFilter) params.set('side', sideFilter)

  const { data, isLoading } = useSWR<{ trades: TradeRecord[]; total: number; totalPages: number }>(
    `/api/history?${params}`,
    fetcher
  )

  const trades = data?.trades ?? []

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Trade History</h1>
          <p className="text-text-muted text-sm mt-1">
            {data?.total ? `${data.total} total trades` : 'All your executed orders'}
          </p>
        </div>

        {/* Filter */}
        <div className="flex rounded-lg overflow-hidden border border-border text-sm">
          {(['', 'BUY', 'SELL'] as const).map(f => (
            <button
              key={f}
              onClick={() => { setSideFilter(f); setPage(1) }}
              className={`px-4 py-2 transition-colors ${
                sideFilter === f
                  ? 'bg-brand/10 text-brand'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {f || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : trades.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-text-muted text-sm">No trades found.</p>
            <Link href="/markets" className="text-brand text-sm hover:underline mt-1 block">
              Start trading →
            </Link>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs text-text-muted font-medium py-3 px-5">Asset</th>
                  <th className="text-left text-xs text-text-muted font-medium py-3 px-4">Side</th>
                  <th className="text-right text-xs text-text-muted font-medium py-3 px-4">Quantity</th>
                  <th className="text-right text-xs text-text-muted font-medium py-3 px-4">Price</th>
                  <th className="text-right text-xs text-text-muted font-medium py-3 px-4">Total</th>
                  <th className="text-left text-xs text-text-muted font-medium py-3 px-4">Reason</th>
                  <th className="text-right text-xs text-text-muted font-medium py-3 px-5">Time</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(trade => (
                  <tr key={trade.id} className="table-row">
                    <td className="py-3 px-5">
                      <Link href={`/markets/${trade.symbol}?type=${trade.assetType}`} className="hover:text-brand transition-colors">
                        <p className="font-medium text-text-primary">{trade.symbol}</p>
                        <p className="text-xs text-text-muted truncate max-w-[140px]">{trade.assetName}</p>
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${
                        trade.side === 'BUY' ? 'bg-green/10 text-green' :
                        trade.side === 'SELL' ? 'bg-red/10 text-red' :
                        trade.side === 'SHORT' ? 'bg-orange-500/10 text-orange-500' :
                        'bg-blue-500/10 text-blue-500'
                      }`}>
                        {(trade.side === 'BUY' || trade.side === 'COVER')
                          ? <ArrowUpRight className="w-3 h-3" />
                          : <ArrowDownRight className="w-3 h-3" />
                        }
                        {trade.side}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-text-primary">
                      {formatQuantity(trade.quantity, trade.assetType)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-text-secondary">
                      {formatCurrency(trade.price)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-text-primary">
                      {formatCurrency(trade.totalValue)}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      {trade.reason ? (
                        <span
                          className="text-xs text-text-muted block truncate"
                          title={trade.reason}
                        >
                          {trade.reason}
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right text-text-muted text-xs">
                      <p>{timeAgo(trade.createdAt)}</p>
                      {trade.note && (
                        <p className="flex items-center gap-1 justify-end text-text-muted mt-0.5 max-w-[160px] ml-auto">
                          <FileText className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{trade.note}</span>
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                <span className="text-xs text-text-muted">
                  Page {page} of {data.totalPages}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded text-text-muted hover:text-text-primary disabled:opacity-40 hover:bg-surface-2 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                    disabled={page === data.totalPages}
                    className="p-1.5 rounded text-text-muted hover:text-text-primary disabled:opacity-40 hover:bg-surface-2 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
