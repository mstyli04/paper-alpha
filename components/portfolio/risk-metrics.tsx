'use client'

import useSWR from 'swr'
import { TrendingUp, TrendingDown, Activity, Target, Zap } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { RiskMetrics } from '@/app/api/portfolio/metrics/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function Metric({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">{label}</p>
      <p className={`text-lg font-bold font-mono tabular-nums ${color ?? 'text-text-primary'}`}>{value}</p>
      {sub && <p className="text-xs text-text-muted">{sub}</p>}
    </div>
  )
}

function pnlCol(n: number) {
  return n > 0 ? 'text-green' : n < 0 ? 'text-red' : 'text-text-primary'
}

export function RiskMetricsCard() {
  const { data, isLoading } = useSWR<RiskMetrics>('/api/portfolio/metrics', fetcher, {
    revalidateOnFocus: false,
  })

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-5">
        <Activity className="w-4 h-4 text-brand" />
        <h2 className="text-sm font-semibold text-text-primary">Risk Metrics</h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      ) : !data || data.snapshotCount < 2 ? (
        <p className="text-sm text-text-muted">
          Not enough data yet. Risk metrics will appear after your portfolio has been tracked for at least 2 days.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          <Metric
            label="Total Return"
            value={`${data.totalReturn >= 0 ? '+' : ''}${data.totalReturn.toFixed(2)}%`}
            color={pnlCol(data.totalReturn)}
          />
          <Metric
            label="Sharpe Ratio"
            value={data.sharpeRatio !== null ? data.sharpeRatio.toFixed(2) : '—'}
            sub="Risk-adjusted return"
            color={data.sharpeRatio !== null ? (data.sharpeRatio >= 1 ? 'text-green' : data.sharpeRatio >= 0 ? 'text-text-primary' : 'text-red') : undefined}
          />
          <Metric
            label="Max Drawdown"
            value={`${data.maxDrawdown.toFixed(2)}%`}
            sub="Worst peak-to-trough"
            color={data.maxDrawdown < -10 ? 'text-red' : data.maxDrawdown < -5 ? 'text-yellow-500' : 'text-text-primary'}
          />
          <Metric
            label="Volatility"
            value={`${data.volatility.toFixed(1)}%`}
            sub="Annualised"
          />
          <Metric
            label="Best Day"
            value={`+${data.bestDay.toFixed(2)}%`}
            color="text-green"
          />
          <Metric
            label="Worst Day"
            value={`${data.worstDay.toFixed(2)}%`}
            color="text-red"
          />
          <Metric
            label="Win Rate"
            value={data.winRate !== null ? `${data.winRate}%` : '—'}
            sub="Profitable closes"
            color={data.winRate !== null ? (data.winRate >= 50 ? 'text-green' : 'text-red') : undefined}
          />
          <Metric
            label="Total Trades"
            value={String(data.totalTrades)}
            sub="All time"
          />
        </div>
      )}
    </div>
  )
}
