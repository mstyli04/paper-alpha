'use client'

import useSWR from 'swr'
import { Bitcoin } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface RelativeData {
  label: string
  assetReturn: number | null
  btcReturn: number | null
  relativeStrength: number | null
}

interface Props {
  symbol: string
}

function SignedPct({ value }: { value: number | null }) {
  if (value === null) return <span className="text-text-muted font-mono">—</span>
  const color = value > 0 ? 'text-green' : value < 0 ? 'text-red' : 'text-text-muted'
  return (
    <span className={`font-mono font-medium ${color}`}>
      {value >= 0 ? '+' : ''}{value.toFixed(2)}%
    </span>
  )
}

export function BtcRelativeStrength({ symbol }: Props) {
  const { data, isLoading } = useSWR<{ symbol: string; data: RelativeData[] }>(
    `/api/market/btc-relative?symbol=${symbol}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Bitcoin className="w-4 h-4 text-orange-400" />
        <h3 className="text-sm font-semibold text-text-primary">Relative Strength vs BTC</h3>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      ) : !data?.data ? (
        <p className="text-xs text-text-muted">Unavailable</p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1 text-xs text-text-muted font-medium text-center pb-1 border-b border-border">
            <span className="text-left">Period</span>
            <span>{symbol}</span>
            <span>BTC</span>
            <span>vs BTC</span>
          </div>

          {data.data.map(row => (
            <div key={row.label} className="grid grid-cols-4 gap-1 text-xs text-center items-center">
              <span className="text-left text-text-muted font-medium">{row.label}</span>
              <SignedPct value={row.assetReturn} />
              <SignedPct value={row.btcReturn} />
              <div className="flex items-center justify-center">
                {row.relativeStrength !== null ? (
                  <span className={`px-1.5 py-0.5 text-[11px] font-bold font-mono ${
                    row.relativeStrength > 0
                      ? 'bg-green text-[#0a0a0a]'
                      : row.relativeStrength < 0
                      ? 'bg-red text-[#0a0a0a]'
                      : 'bg-surface-2 text-text-muted'
                  }`}>
                    {row.relativeStrength >= 0 ? '+' : ''}{row.relativeStrength.toFixed(2)}%
                  </span>
                ) : (
                  <span className="text-text-muted">—</span>
                )}
              </div>
            </div>
          ))}

          <p className="text-xs text-text-muted pt-1 border-t border-border">
            Positive = outperforming BTC · Negative = underperforming BTC
          </p>
        </>
      )}
    </div>
  )
}
