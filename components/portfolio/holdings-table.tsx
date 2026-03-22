'use client'

import Link from 'next/link'
import { formatCurrency, formatPercent, formatQuantity, pnlColor } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import type { Holding } from '@/types'

interface HoldingsTableProps {
  holdings: Holding[]
  loading?: boolean
}

export function HoldingsTable({ holdings, loading }: HoldingsTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  if (!holdings.length) {
    return (
      <div className="text-center py-12 text-text-muted">
        <p className="text-sm">No holdings yet.</p>
        <p className="text-xs mt-1">Go to <Link href="/markets" className="text-brand hover:underline">Markets</Link> to start trading.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-xs text-text-muted font-medium py-3 px-4">Asset</th>
            <th className="text-right text-xs text-text-muted font-medium py-3 px-4">Quantity</th>
            <th className="text-right text-xs text-text-muted font-medium py-3 px-4">Avg Entry</th>
            <th className="text-right text-xs text-text-muted font-medium py-3 px-4">Current Price</th>
            <th className="text-right text-xs text-text-muted font-medium py-3 px-4">Value</th>
            <th className="text-right text-xs text-text-muted font-medium py-3 px-4">P&L</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map(h => {
            const isShort = h.quantity < 0
            return (
              <tr key={h.symbol} className="table-row">
                <td className="py-3 px-4">
                  <Link href={`/markets/${h.symbol}?type=${h.assetType}`} className="hover:text-brand transition-colors">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-text-primary">{h.symbol}</p>
                      {isShort && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-semibold border border-orange-500/20">
                          SHORT
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted capitalize">{h.assetType.toLowerCase()}</p>
                  </Link>
                </td>
                <td className="py-3 px-4 text-right font-mono text-text-primary">
                  {formatQuantity(Math.abs(h.quantity), h.assetType)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-text-secondary">
                  {formatCurrency(h.avgCostBasis)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-text-primary">
                  {h.currentPrice ? formatCurrency(h.currentPrice) : '—'}
                </td>
                <td className="py-3 px-4 text-right font-mono text-text-primary">
                  {h.currentValue !== undefined
                    ? isShort
                      ? <span className="text-orange-400">{formatCurrency(h.currentValue)}</span>
                      : formatCurrency(h.currentValue)
                    : '—'}
                </td>
                <td className="py-3 px-4 text-right">
                  <p className={`font-mono font-medium ${pnlColor(h.unrealizedPnl ?? 0)}`}>
                    {h.unrealizedPnl !== undefined ? formatCurrency(h.unrealizedPnl) : '—'}
                  </p>
                  <p className={`text-xs ${pnlColor(h.unrealizedPnlPercent ?? 0)}`}>
                    {h.unrealizedPnlPercent !== undefined ? formatPercent(h.unrealizedPnlPercent) : ''}
                  </p>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
