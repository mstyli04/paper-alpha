'use client'

import useSWR from 'swr'
import { usePortfolio } from '@/hooks/use-portfolio'
import { formatCurrency, formatPercent, pnlColor } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import type { PortfolioSnapshot } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface PeriodStat {
  label: string
  pnl: number
  pct: number | null
}

function getStartOfDay(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function getStartOfWeek(): Date {
  const d = new Date()
  const day = d.getDay() // 0=Sun
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

function getStartOfMonth(): Date {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

function findClosestSnapshot(snapshots: PortfolioSnapshot[], before: Date): PortfolioSnapshot | null {
  // Find the last snapshot before or equal to the given date
  const beforeMs = before.getTime()
  let best: PortfolioSnapshot | null = null
  for (const s of snapshots) {
    const t = new Date(s.createdAt).getTime()
    if (t <= beforeMs) {
      best = s
    } else {
      break
    }
  }
  return best
}

function calcPeriod(
  snapshots: PortfolioSnapshot[],
  currentValue: number,
  startDate: Date,
  startingBalance: number
): { pnl: number; pct: number } {
  const baseline = findClosestSnapshot(snapshots, startDate)
  const baseValue = baseline ? baseline.totalValue : startingBalance
  const pnl = currentValue - baseValue
  const pct = baseValue > 0 ? (pnl / baseValue) * 100 : 0
  return { pnl, pct }
}

export function PnlPeriods() {
  const { portfolio, isLoading: portfolioLoading } = usePortfolio()
  const { data: snapshots, isLoading: snapshotsLoading } = useSWR<PortfolioSnapshot[]>(
    '/api/portfolio/snapshots',
    fetcher
  )

  const isLoading = portfolioLoading || snapshotsLoading

  const periods: PeriodStat[] = (() => {
    if (!snapshots || !portfolio) return []

    const currentValue = portfolio.totalValue
    const startingBalance = portfolio.startingBalance

    const today = calcPeriod(snapshots, currentValue, getStartOfDay(), startingBalance)
    const week = calcPeriod(snapshots, currentValue, getStartOfWeek(), startingBalance)
    const month = calcPeriod(snapshots, currentValue, getStartOfMonth(), startingBalance)
    const allTime = {
      pnl: portfolio.totalPnl,
      pct: portfolio.totalPnlPercent,
    }

    return [
      { label: 'Today', pnl: today.pnl, pct: today.pct },
      { label: 'This Week', pnl: week.pnl, pct: week.pct },
      { label: 'This Month', pnl: month.pnl, pct: month.pct },
      { label: 'All Time', pnl: allTime.pnl, pct: allTime.pct },
    ]
  })()

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {isLoading
        ? Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4">
              <Skeleton className="h-3.5 w-20 mb-3" />
              <Skeleton className="h-6 w-28 mb-1.5" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))
        : periods.map((p) => (
            <div key={p.label} className="card p-4">
              <p className="stat-label mb-2">{p.label}</p>
              <p className={`stat-value text-lg font-mono ${pnlColor(p.pnl)}`}>
                {p.pnl >= 0 ? '+' : ''}{formatCurrency(p.pnl)}
              </p>
              {p.pct !== null && (
                <p className={`text-xs mt-1 font-mono ${pnlColor(p.pct)}`}>
                  {formatPercent(p.pct)}
                </p>
              )}
            </div>
          ))}
    </div>
  )
}
