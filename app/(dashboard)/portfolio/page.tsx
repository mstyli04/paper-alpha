'use client'

import useSWR from 'swr'
import { usePortfolio } from '@/hooks/use-portfolio'
import { StatsCard } from '@/components/portfolio/stats-card'
import { HoldingsTable } from '@/components/portfolio/holdings-table'
import { SectorChart } from '@/components/portfolio/sector-chart'
import { RiskMetricsCard } from '@/components/portfolio/risk-metrics'
import { AchievementsCard } from '@/components/portfolio/achievements-card'
import { PortfolioChart } from '@/components/charts/portfolio-chart'
import { AllocationChart } from '@/components/portfolio/allocation-chart'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatPercent, pnlColor } from '@/lib/utils'
import type { PortfolioSnapshot } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function PortfolioPage() {
  const { portfolio, isLoading } = usePortfolio()
  const { data: snapshots } = useSWR<PortfolioSnapshot[]>('/api/portfolio/snapshots', fetcher)

  const allocationData = portfolio?.holdings
    .sort((a, b) => (b.currentValue ?? 0) - (a.currentValue ?? 0))
    .slice(0, 8) ?? []

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Portfolio</h1>
        <p className="text-text-muted text-sm mt-1">Your holdings and performance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Total Value"
          value={portfolio ? formatCurrency(portfolio.totalValue) : '$—'}
          loading={isLoading}
        />
        <StatsCard
          label="Cash Balance"
          value={portfolio ? formatCurrency(portfolio.cashBalance) : '$—'}
          sub={portfolio ? `${((portfolio.cashBalance / portfolio.totalValue) * 100).toFixed(1)}% of portfolio` : undefined}
          loading={isLoading}
        />
        <StatsCard
          label="Unrealized P&L"
          value={portfolio ? formatCurrency(portfolio.unrealizedPnl) : '$—'}
          sub={portfolio ? formatPercent(portfolio.totalPnlPercent) : undefined}
          subColor={portfolio ? pnlColor(portfolio.unrealizedPnl) : undefined}
          loading={isLoading}
        />
        <StatsCard
          label="Realized P&L"
          value={portfolio ? formatCurrency(portfolio.realizedPnl) : '$—'}
          sub="From closed positions"
          subColor={portfolio ? pnlColor(portfolio.realizedPnl) : undefined}
          loading={isLoading}
        />
      </div>

      {/* Allocation pie chart */}
      <AllocationChart holdings={portfolio?.holdings ?? []} />

      {/* Performance chart */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Performance History</h2>
        {snapshots ? (
          <PortfolioChart
            snapshots={snapshots}
            startingBalance={portfolio?.startingBalance ?? 100000}
            height={240}
            showBenchmark
          />
        ) : (
          <Skeleton className="h-60 w-full" />
        )}
      </div>

      <RiskMetricsCard />

      <AchievementsCard />

      {/* Holdings + Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-text-primary">All Holdings</h2>
          </div>
          <HoldingsTable holdings={portfolio?.holdings ?? []} loading={isLoading} />
        </div>

        <div className="space-y-4">
          <SectorChart holdings={portfolio?.holdings ?? []} />
          <div className="card p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Allocation</h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : allocationData.length === 0 ? (
            <p className="text-sm text-text-muted">No holdings yet</p>
          ) : (
            <div className="space-y-3">
              {/* Cash row */}
              {portfolio && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary font-medium">Cash</span>
                    <span className="text-text-muted">
                      {((portfolio.cashBalance / portfolio.totalValue) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${(portfolio.cashBalance / portfolio.totalValue) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              {allocationData.map((h, i) => {
                const pct = portfolio ? ((h.currentValue ?? 0) / portfolio.totalValue) * 100 : 0
                const colors = ['bg-green', 'bg-red', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500']
                return (
                  <div key={h.symbol} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary font-medium">{h.symbol}</span>
                      <span className="text-text-muted">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div className={`h-full rounded-full ${colors[i % colors.length]}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}
