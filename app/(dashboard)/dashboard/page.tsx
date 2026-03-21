'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react'
import { usePortfolio } from '@/hooks/use-portfolio'
import { StatsCard } from '@/components/portfolio/stats-card'
import { HoldingsTable } from '@/components/portfolio/holdings-table'
import { PortfolioChart } from '@/components/charts/portfolio-chart'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatPercent, pnlColor } from '@/lib/utils'
import useSWR from 'swr'
import type { PortfolioSnapshot, TradeRecord } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function DashboardPage() {
  const { portfolio, isLoading } = usePortfolio()
  const { data: snapshots } = useSWR<PortfolioSnapshot[]>('/api/portfolio/snapshots', fetcher)
  const { data: historyData } = useSWR<{ trades: TradeRecord[] }>('/api/history?limit=5', fetcher)

  // Bootstrap user on first load
  useEffect(() => {
    fetch('/api/user').catch(() => {})
  }, [])

  const recentTrades = historyData?.trades ?? []

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-muted text-sm mt-1">Your paper trading overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Portfolio Value"
          value={portfolio ? formatCurrency(portfolio.totalValue) : '$—'}
          sub={portfolio ? formatPercent(portfolio.totalPnlPercent) : undefined}
          subColor={portfolio ? pnlColor(portfolio.totalPnlPercent) : undefined}
          loading={isLoading}
        />
        <StatsCard
          label="Total P&L"
          value={portfolio ? formatCurrency(portfolio.totalPnl) : '$—'}
          sub={portfolio ? `${portfolio.totalPnl >= 0 ? 'Gain' : 'Loss'} since start` : undefined}
          subColor={portfolio ? pnlColor(portfolio.totalPnl) : undefined}
          loading={isLoading}
        />
        <StatsCard
          label="Cash Balance"
          value={portfolio ? formatCurrency(portfolio.cashBalance) : '$—'}
          sub="Available to invest"
          loading={isLoading}
        />
        <StatsCard
          label="Invested"
          value={portfolio ? formatCurrency(portfolio.totalInvested) : '$—'}
          sub={`${portfolio?.holdings.length ?? 0} position${portfolio?.holdings.length !== 1 ? 's' : ''}`}
          loading={isLoading}
        />
      </div>

      {/* Portfolio chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-primary">Portfolio Performance</h2>
          {portfolio && (
            <span className={`text-sm font-medium ${pnlColor(portfolio.totalPnlPercent)}`}>
              {portfolio.totalPnlPercent >= 0 ? (
                <span className="flex items-center gap-1"><ArrowUpRight className="w-4 h-4" />{formatPercent(portfolio.totalPnlPercent)}</span>
              ) : (
                <span className="flex items-center gap-1"><ArrowDownRight className="w-4 h-4" />{formatPercent(portfolio.totalPnlPercent)}</span>
              )}
            </span>
          )}
        </div>
        {snapshots ? (
          <PortfolioChart
            snapshots={snapshots}
            startingBalance={portfolio?.startingBalance ?? 100000}
            height={220}
          />
        ) : (
          <Skeleton className="h-56 w-full" />
        )}
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Holdings */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-text-primary">Holdings</h2>
            <Link href="/portfolio" className="text-xs text-brand hover:underline">View all</Link>
          </div>
          <HoldingsTable
            holdings={portfolio?.holdings.slice(0, 5) ?? []}
            loading={isLoading}
          />
        </div>

        {/* Recent trades */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-text-primary">Recent Trades</h2>
            <Link href="/history" className="text-xs text-brand hover:underline">View all</Link>
          </div>
          {recentTrades.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <TrendingUp className="w-8 h-8 text-text-muted mx-auto mb-3" />
              <p className="text-sm text-text-muted">No trades yet.</p>
              <Link href="/markets" className="text-xs text-brand hover:underline mt-1 block">
                Explore markets →
              </Link>
            </div>
          ) : (
            <div>
              {recentTrades.map(trade => (
                <div key={trade.id} className="flex items-center justify-between px-5 py-3 border-b border-border last:border-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{trade.symbol}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        trade.side === 'BUY' ? 'bg-green/10 text-green' : 'bg-red/10 text-red'
                      }`}>
                        {trade.side}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted">{new Date(trade.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-text-primary">{formatCurrency(trade.totalValue)}</p>
                    <p className="text-xs text-text-muted">{trade.quantity} @ {formatCurrency(trade.price)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
