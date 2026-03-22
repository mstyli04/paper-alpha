'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, BarChart2, Wallet, Target, Clock, X } from 'lucide-react'
import { usePortfolio } from '@/hooks/use-portfolio'
import { HoldingsTable } from '@/components/portfolio/holdings-table'
import { PortfolioChart } from '@/components/charts/portfolio-chart'
import { PnlPeriods } from '@/components/portfolio/pnl-periods'
import { TradeFeed } from '@/components/feed/trade-feed'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatPercent, pnlColor } from '@/lib/utils'
import useSWR from 'swr'
import type { PortfolioSnapshot } from '@/types'
import { cn } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface StatCardProps {
  label: string
  value: string
  sub?: string
  subColor?: string
  icon: React.ReactNode
  accent?: 'brand' | 'green' | 'red' | 'neutral'
  loading?: boolean
}

function StatCard({ label, value, sub, subColor, icon, accent = 'brand', loading }: StatCardProps) {
  const accentBorder = {
    brand: 'border-t-brand',
    green: 'border-t-green',
    red: 'border-t-red',
    neutral: 'border-t-border-2',
  }[accent]

  return (
    <div className={cn('card p-4 border-t-2', accentBorder)}>
      <div className="flex items-start justify-between mb-3">
        <p className="stat-label">{label}</p>
        <div className={cn(
          'p-1.5 rounded-md',
          accent === 'brand' ? 'bg-brand/10 text-brand' :
          accent === 'green' ? 'bg-green/10 text-green' :
          accent === 'red' ? 'bg-red/10 text-red' :
          'bg-surface-2 text-text-muted'
        )}>
          {icon}
        </div>
      </div>
      {loading ? (
        <>
          <Skeleton className="h-7 w-28 mb-1.5" />
          <Skeleton className="h-3.5 w-20" />
        </>
      ) : (
        <>
          <p className="stat-value text-xl">{value}</p>
          {sub && <p className={cn('text-xs mt-1', subColor || 'text-text-muted')}>{sub}</p>}
        </>
      )}
    </div>
  )
}

const ONBOARDING_DISMISSED_KEY = 'paper-alpha:onboarding-dismissed'

export default function DashboardPage() {
  const { portfolio, isLoading } = usePortfolio()
  const { data: snapshots } = useSWR<PortfolioSnapshot[]>('/api/portfolio/snapshots', fetcher)
  const [onboardingDismissed, setOnboardingDismissed] = useState(true) // start true to avoid flash

  // Bootstrap user on first load
  useEffect(() => {
    fetch('/api/user').catch(() => {})
  }, [])

  useEffect(() => {
    const dismissed = localStorage.getItem(ONBOARDING_DISMISSED_KEY)
    if (!dismissed) setOnboardingDismissed(false)
  }, [])

  function dismissOnboarding() {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, '1')
    setOnboardingDismissed(true)
  }

  const hasNoActivity = !isLoading && portfolio &&
    portfolio.holdings.length === 0 &&
    portfolio.realizedPnl === 0

  const showOnboarding = hasNoActivity && !onboardingDismissed

  const winRate = portfolio && portfolio.holdings.length > 0
    ? Math.round((portfolio.holdings.filter(h => (h.unrealizedPnl ?? 0) > 0).length / portfolio.holdings.length) * 100)
    : null

  const allocation = portfolio
    ? Math.round((portfolio.totalInvested / portfolio.totalValue) * 100)
    : null

  const pnlAccent = portfolio
    ? (portfolio.totalPnl >= 0 ? 'green' : 'red')
    : 'neutral'

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">Dashboard</h1>
          <p className="text-xs text-text-muted mt-0.5">Portfolio overview · Paper trading simulation</p>
        </div>
        <Link href="/markets" className="btn-secondary flex items-center gap-1.5 py-1.5 px-3 text-xs">
          <TrendingUp className="w-3.5 h-3.5" /> Trade
        </Link>
      </div>

      {/* Onboarding banner */}
      {showOnboarding && (
        <div className="card p-5 border border-brand/30 bg-brand/5 relative">
          <button
            onClick={dismissOnboarding}
            className="absolute top-3 right-3 text-text-muted hover:text-text-primary transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-semibold text-text-primary mb-1">Welcome to Paper Alpha!</h2>
          <p className="text-xs text-text-muted mb-4">Practice trading with virtual money. Get started in 3 easy steps:</p>
          <ol className="space-y-2 mb-4">
            {[
              { step: '1', text: 'Go to Markets to browse stocks and crypto' },
              { step: '2', text: 'Search for a stock you\'re interested in' },
              { step: '3', text: 'Place your first paper trade' },
            ].map(({ step, text }) => (
              <li key={step} className="flex items-center gap-3 text-xs text-text-secondary">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand/20 text-brand text-[10px] font-bold flex items-center justify-center">
                  {step}
                </span>
                {text}
              </li>
            ))}
          </ol>
          <Link
            href="/markets"
            className="btn-primary inline-flex items-center gap-1.5 py-1.5 px-4 text-xs"
          >
            Go to Markets <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard
          label="Portfolio Value"
          value={portfolio ? formatCurrency(portfolio.totalValue) : '$—'}
          sub={portfolio ? `${formatPercent(portfolio.totalPnlPercent)} all time` : undefined}
          subColor={portfolio ? pnlColor(portfolio.totalPnlPercent) : undefined}
          icon={<BarChart2 className="w-3.5 h-3.5" />}
          accent="brand"
          loading={isLoading}
        />
        <StatCard
          label="Total P&L"
          value={portfolio ? formatCurrency(portfolio.totalPnl) : '$—'}
          sub={portfolio ? (portfolio.totalPnl >= 0 ? '▲ Unrealized gain' : '▼ Unrealized loss') : undefined}
          subColor={portfolio ? pnlColor(portfolio.totalPnl) : undefined}
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          accent={pnlAccent as 'green' | 'red' | 'neutral'}
          loading={isLoading}
        />
        <StatCard
          label="Cash Balance"
          value={portfolio ? formatCurrency(portfolio.cashBalance) : '$—'}
          sub="Available to deploy"
          icon={<DollarSign className="w-3.5 h-3.5" />}
          accent="neutral"
          loading={isLoading}
        />
        <StatCard
          label="Invested"
          value={portfolio ? formatCurrency(portfolio.totalInvested) : '$—'}
          sub={`${portfolio?.holdings.length ?? 0} open position${portfolio?.holdings.length !== 1 ? 's' : ''}`}
          icon={<Wallet className="w-3.5 h-3.5" />}
          accent="brand"
          loading={isLoading}
        />
        <StatCard
          label="Win Rate"
          value={winRate !== null ? `${winRate}%` : '—'}
          sub={portfolio ? `${portfolio.holdings.filter(h => (h.unrealizedPnl ?? 0) > 0).length} of ${portfolio.holdings.length} positions` : 'No positions'}
          subColor={winRate !== null ? (winRate >= 50 ? 'text-green' : 'text-red') : undefined}
          icon={<Target className="w-3.5 h-3.5" />}
          accent={winRate !== null ? (winRate >= 50 ? 'green' : 'red') : 'neutral'}
          loading={isLoading}
        />
        <StatCard
          label="Allocation"
          value={allocation !== null ? `${allocation}%` : '—'}
          sub="Capital deployed"
          icon={<Clock className="w-3.5 h-3.5" />}
          accent="neutral"
          loading={isLoading}
        />
      </div>

      {/* P&L by period */}
      <PnlPeriods />

      {/* Portfolio chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Equity Curve</h2>
            <p className="text-xs text-text-muted mt-0.5">Portfolio value over time</p>
          </div>
          {portfolio && (
            <div className="flex items-center gap-1.5">
              {portfolio.totalPnlPercent >= 0
                ? <ArrowUpRight className={`w-4 h-4 ${pnlColor(portfolio.totalPnlPercent)}`} />
                : <ArrowDownRight className={`w-4 h-4 ${pnlColor(portfolio.totalPnlPercent)}`} />
              }
              <span className={`text-sm font-semibold font-mono ${pnlColor(portfolio.totalPnlPercent)}`}>
                {formatPercent(portfolio.totalPnlPercent)}
              </span>
            </div>
          )}
        </div>
        {snapshots ? (
          <PortfolioChart
            snapshots={snapshots}
            startingBalance={portfolio?.startingBalance ?? 100000}
            height={200}
          />
        ) : (
          <Skeleton className="h-52 w-full" />
        )}
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Holdings */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Open Positions</h2>
              <p className="text-xs text-text-muted mt-0.5">{portfolio?.holdings.length ?? 0} active holdings</p>
            </div>
            <Link href="/portfolio" className="text-xs text-brand hover:text-brand-dim transition-colors">
              View all →
            </Link>
          </div>
          <HoldingsTable
            holdings={portfolio?.holdings.slice(0, 5) ?? []}
            loading={isLoading}
          />
        </div>

        <TradeFeed />
      </div>
    </div>
  )
}
