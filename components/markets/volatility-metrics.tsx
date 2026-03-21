'use client'

import useSWR from 'swr'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface Metrics {
  annualizedVol: number
  sharpe: number
  maxDrawdown: number
  totalReturn: number
  bestDay: number
  worstDay: number
  dataPoints: number
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

function MetricRow({
  label,
  value,
  suffix = '',
  colorize = false,
  invert = false,
  tooltip,
}: {
  label: string
  value: number
  suffix?: string
  colorize?: boolean
  invert?: boolean
  tooltip?: string
}) {
  const isGood = invert ? value < 0 : value > 0
  const color = colorize ? (isGood ? 'text-green' : 'text-red') : 'text-text-primary'

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
      <div>
        <span className="text-sm text-text-secondary">{label}</span>
        {tooltip && <p className="text-xs text-text-muted mt-0.5">{tooltip}</p>}
      </div>
      <span className={cn('text-sm font-medium font-mono', color)}>
        {value > 0 && colorize ? '+' : ''}{value}{suffix}
      </span>
    </div>
  )
}

export function VolatilityMetrics({ symbol, assetType }: { symbol: string; assetType: 'STOCK' | 'CRYPTO' }) {
  const { data, isLoading } = useSWR<Metrics>(
    `/api/market/metrics?symbol=${symbol}&assetType=${assetType}`,
    fetcher
  )

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-3">Risk & Performance (1Y)</h3>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      ) : !data || 'error' in data ? (
        <p className="text-sm text-text-muted">Not enough historical data</p>
      ) : (
        <div>
          <MetricRow
            label="Annualized Volatility"
            value={data.annualizedVol}
            suffix="%"
            tooltip="Std dev of daily returns × √252"
          />
          <MetricRow
            label="Sharpe Ratio"
            value={data.sharpe}
            colorize
            tooltip="Risk-adjusted return vs 5% risk-free rate"
          />
          <MetricRow
            label="Max Drawdown"
            value={-data.maxDrawdown}
            suffix="%"
            colorize
            tooltip="Largest peak-to-trough decline"
          />
          <MetricRow
            label="Total Return"
            value={data.totalReturn}
            suffix="%"
            colorize
            tooltip="Price change over 1 year"
          />
          <MetricRow
            label="Best Single Day"
            value={data.bestDay}
            suffix="%"
            colorize
          />
          <MetricRow
            label="Worst Single Day"
            value={data.worstDay}
            suffix="%"
            colorize
          />
        </div>
      )}
    </div>
  )
}
