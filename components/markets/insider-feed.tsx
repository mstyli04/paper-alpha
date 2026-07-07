'use client'

import useSWR from 'swr'
import { Building2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import type { InsiderTransaction } from '@/app/api/market/insider/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function formatShares(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatName(name: string): string {
  return name
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

interface InsiderFeedProps {
  symbol: string
}

export function InsiderFeed({ symbol }: InsiderFeedProps) {
  const { data, isLoading } = useSWR<InsiderTransaction[]>(
    `/api/market/insider?symbol=${symbol}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  if (!isLoading && (!data || data.length === 0)) return null

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <Building2 className="w-4 h-4 text-brand" />
        <h3 className="text-sm font-semibold text-text-primary">Insider Transactions</h3>
        <span className="text-xs text-text-muted ml-auto">SEC Form 4</span>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : (
        <div className="p-4 space-y-2">
          {data!.map((t, i) => {
            const isBuy = t.transactionCode === 'P'
            const totalValue = Math.abs(t.change) * t.transactionPrice
            return (
              <div key={i} className="row-boxed flex items-center gap-3">
                <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 flex-shrink-0 ${
                  isBuy ? 'bg-green text-[#0a0a0a]' : 'bg-red text-[#0a0a0a]'
                }`}>
                  {isBuy ? 'BUY' : 'SELL'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{formatName(t.name)}</p>
                  <p className="text-xs text-text-muted">{t.transactionDate}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-mono text-text-primary">
                    {formatShares(Math.abs(t.change))} shares
                  </p>
                  {t.transactionPrice > 0 && (
                    <p className="text-xs text-text-muted">
                      @ {formatCurrency(t.transactionPrice)} · {formatCurrency(totalValue)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
