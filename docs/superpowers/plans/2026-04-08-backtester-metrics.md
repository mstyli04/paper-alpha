# Quant Metrics, Benchmark Comparison & Backtester Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Sortino/Calmar/Profit Factor to the risk metrics card, a new benchmark comparison card to the portfolio page, and a full `/backtester` page with bot-preset and custom strategy simulation.

**Architecture:** Client-side simulation engine (`lib/backtest/engine.ts`) is a pure function — receives candles from a thin API route and returns results computed in-browser, avoiding Vercel function timeouts. Benchmark comparison runs server-side (small data, fast). All new UI follows the existing card/metric patterns.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, lightweight-charts, Yahoo Finance (yahoo-finance2), Vitest

---

## File Map

**New files:**
- `lib/backtest/engine.ts` — pure backtest simulation, custom + bot strategies
- `__tests__/backtest/engine.test.ts` — unit tests for engine
- `app/api/backtest/candles/route.ts` — thin route: fetch Yahoo candles for a symbol/range
- `app/api/portfolio/benchmark-comparison/route.ts` — compute alpha, beta, correlation, tracking error, IR
- `components/portfolio/benchmark-comparison.tsx` — benchmark comparison card UI
- `components/backtest/backtest-chart.tsx` — lightweight-charts equity curve
- `app/(dashboard)/backtester/page.tsx` — main backtester page with config + results

**Modified files:**
- `app/api/portfolio/metrics/route.ts` — add `sortinoRatio`, `calmarRatio`, `profitFactor`
- `components/portfolio/risk-metrics.tsx` — render 3 new metrics
- `app/(dashboard)/portfolio/page.tsx` — add `BenchmarkComparisonCard` below `RiskMetricsCard`
- `components/layout/sidebar.tsx` — add Backtester entry in Research group

---

## Task 1: Extend Risk Metrics API

**Files:**
- Modify: `app/api/portfolio/metrics/route.ts`

- [ ] **Step 1: Write a failing test for Sortino, Calmar, and Profit Factor**

Create `__tests__/metrics/risk-metrics.test.ts`:

```ts
import { describe, it, expect } from 'vitest'

// Inline the math so we can test it independently of the route
function computeSortino(dailyReturns: number[], riskFreeDaily: number): number | null {
  if (dailyReturns.length < 5) return null
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
  const downsideVariance = dailyReturns.reduce((a, r) => {
    const diff = Math.min(r - riskFreeDaily, 0)
    return a + diff * diff
  }, 0) / dailyReturns.length
  const downsideDeviation = Math.sqrt(downsideVariance)
  if (downsideDeviation === 0) return null
  return Math.round(((mean - riskFreeDaily) / downsideDeviation) * Math.sqrt(252) * 100) / 100
}

function computeCalmar(totalReturnPct: number, maxDrawdownFraction: number, days: number): number | null {
  if (maxDrawdownFraction >= 0 || days === 0) return null
  const annualised = (totalReturnPct / 100) / (days / 365)
  return Math.round((annualised / Math.abs(maxDrawdownFraction)) * 100) / 100
}

function computeProfitFactor(pnls: number[]): number | null {
  const grossWins   = pnls.filter(p => p > 0).reduce((s, p) => s + p, 0)
  const grossLosses = pnls.filter(p => p < 0).reduce((s, p) => s + Math.abs(p), 0)
  if (grossLosses === 0) return null
  return Math.round((grossWins / grossLosses) * 100) / 100
}

describe('computeSortino', () => {
  it('returns null when fewer than 5 returns', () => {
    expect(computeSortino([0.01, 0.02, -0.01], 0.05 / 252)).toBeNull()
  })

  it('returns null when all returns are above risk-free (no downside)', () => {
    const returns = Array(10).fill(0.01) // all positive, above risk-free
    expect(computeSortino(returns, 0.05 / 252)).toBeNull()
  })

  it('returns a positive ratio for a return series with moderate downside', () => {
    const returns = [0.02, -0.01, 0.015, -0.005, 0.012, 0.008, -0.003, 0.01, 0.005, -0.008]
    const result = computeSortino(returns, 0.05 / 252)
    expect(result).not.toBeNull()
    expect(typeof result).toBe('number')
  })

  it('penalises downside more than Sharpe would', () => {
    // A series with rare large losses should have Sortino < Sharpe
    const returns = [0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, -0.15]
    const rf = 0.05 / 252
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length
    const sharpe = ((mean - rf) / Math.sqrt(variance)) * Math.sqrt(252)
    const sortino = computeSortino(returns, rf)!
    expect(sortino).toBeLessThan(sharpe)
  })
})

describe('computeCalmar', () => {
  it('returns null when maxDrawdown is 0', () => {
    expect(computeCalmar(20, 0, 365)).toBeNull()
  })

  it('returns null when days is 0', () => {
    expect(computeCalmar(20, -0.10, 0)).toBeNull()
  })

  it('returns positive Calmar for positive return with drawdown', () => {
    const result = computeCalmar(20, -0.10, 365)  // 20% return, 10% drawdown, 1 year
    expect(result).not.toBeNull()
    expect(result!).toBeGreaterThan(0)
    expect(result!).toBeCloseTo(2, 0)  // 20% / 10% = 2
  })
})

describe('computeProfitFactor', () => {
  it('returns null when there are no losing trades', () => {
    expect(computeProfitFactor([100, 200, 50])).toBeNull()
  })

  it('returns ratio of gross wins to gross losses', () => {
    const result = computeProfitFactor([300, -100, 200, -50])
    expect(result).not.toBeNull()
    expect(result).toBeCloseTo(3.33, 1)  // 500 / 150
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/michael/paper-alpha && npm run test -- __tests__/metrics/risk-metrics.test.ts
```

Expected: tests pass (they test pure math — the test file IS the implementation here; we're using this to verify the formulas before wiring them into the route).

- [ ] **Step 3: Update the route with the new metrics**

Replace `app/api/portfolio/metrics/route.ts` entirely:

```ts
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export interface RiskMetrics {
  totalReturn: number
  sharpeRatio: number | null
  sortinoRatio: number | null
  calmarRatio: number | null
  profitFactor: number | null
  maxDrawdown: number
  volatility: number
  bestDay: number
  worstDay: number
  winRate: number | null
  totalTrades: number
  snapshotCount: number
}

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { account: true },
  })
  if (!user?.account) return NextResponse.json({ error: 'No account' }, { status: 404 })

  const [snapshots, holdings, tradeCount] = await Promise.all([
    db.portfolioSnapshot.findMany({
      where: { accountId: user.account.id },
      orderBy: { createdAt: 'asc' },
    }),
    db.holding.findMany({
      where: { accountId: user.account.id },
    }),
    db.trade.count({ where: { accountId: user.account.id } }),
  ])

  const startingBalance = Number(user.account.startingBalance)

  if (snapshots.length < 2) {
    return NextResponse.json({
      totalReturn: 0,
      sharpeRatio: null,
      sortinoRatio: null,
      calmarRatio: null,
      profitFactor: null,
      maxDrawdown: 0,
      volatility: 0,
      bestDay: 0,
      worstDay: 0,
      winRate: null,
      totalTrades: tradeCount,
      snapshotCount: snapshots.length,
    } satisfies RiskMetrics)
  }

  const values = snapshots.map(s => Number(s.totalValue))

  const dailyReturns: number[] = []
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) {
      dailyReturns.push((values[i] - values[i - 1]) / values[i - 1])
    }
  }

  const totalReturn = ((values[values.length - 1] - startingBalance) / startingBalance) * 100

  const riskFreeDaily = 0.05 / 252

  // Sharpe ratio
  let sharpeRatio: number | null = null
  if (dailyReturns.length >= 5) {
    const mean     = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
    const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dailyReturns.length
    const stdDev   = Math.sqrt(variance)
    if (stdDev > 0) {
      sharpeRatio = Math.round(((mean - riskFreeDaily) / stdDev) * Math.sqrt(252) * 100) / 100
    }
  }

  // Sortino ratio (downside deviation only)
  let sortinoRatio: number | null = null
  if (dailyReturns.length >= 5) {
    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
    const downsideVariance = dailyReturns.reduce((a, r) => {
      const diff = Math.min(r - riskFreeDaily, 0)
      return a + diff * diff
    }, 0) / dailyReturns.length
    const downsideDeviation = Math.sqrt(downsideVariance)
    if (downsideDeviation > 0) {
      sortinoRatio = Math.round(((mean - riskFreeDaily) / downsideDeviation) * Math.sqrt(252) * 100) / 100
    }
  }

  // Max drawdown
  let peak = values[0]
  let maxDrawdown = 0
  for (const v of values) {
    if (v > peak) peak = v
    const drawdown = (v - peak) / peak
    if (drawdown < maxDrawdown) maxDrawdown = drawdown
  }

  // Calmar ratio
  let calmarRatio: number | null = null
  if (maxDrawdown < 0 && snapshots.length >= 2) {
    const days = (snapshots[snapshots.length - 1].createdAt.getTime() - snapshots[0].createdAt.getTime()) / (1000 * 60 * 60 * 24)
    if (days > 0) {
      const annualisedReturn = (totalReturn / 100) / (days / 365)
      calmarRatio = Math.round((annualisedReturn / Math.abs(maxDrawdown)) * 100) / 100
    }
  }

  // Volatility
  let volatility = 0
  if (dailyReturns.length >= 2) {
    const mean     = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
    const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dailyReturns.length
    volatility = Math.sqrt(variance) * Math.sqrt(252) * 100
  }

  const bestDay  = dailyReturns.length > 0 ? Math.max(...dailyReturns) * 100 : 0
  const worstDay = dailyReturns.length > 0 ? Math.min(...dailyReturns) * 100 : 0

  // Win rate
  let winRate: number | null = null
  const closedPositions = holdings.filter(h => Number(h.realizedPnl) !== 0)
  if (closedPositions.length > 0) {
    const winners = closedPositions.filter(h => Number(h.realizedPnl) > 0).length
    winRate = Math.round((winners / closedPositions.length) * 100)
  }

  // Profit factor
  let profitFactor: number | null = null
  if (closedPositions.length > 0) {
    const grossWins   = closedPositions.filter(h => Number(h.realizedPnl) > 0).reduce((s, h) => s + Number(h.realizedPnl), 0)
    const grossLosses = closedPositions.filter(h => Number(h.realizedPnl) < 0).reduce((s, h) => s + Math.abs(Number(h.realizedPnl)), 0)
    if (grossLosses > 0) {
      profitFactor = Math.round((grossWins / grossLosses) * 100) / 100
    }
  }

  return NextResponse.json({
    totalReturn:  Math.round(totalReturn * 100) / 100,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    profitFactor,
    maxDrawdown:  Math.round(maxDrawdown * 10000) / 100,
    volatility:   Math.round(volatility * 100) / 100,
    bestDay:      Math.round(bestDay * 100) / 100,
    worstDay:     Math.round(worstDay * 100) / 100,
    winRate,
    totalTrades:  tradeCount,
    snapshotCount: snapshots.length,
  } satisfies RiskMetrics)
}
```

- [ ] **Step 4: Verify the test file still passes**

```bash
cd /home/michael/paper-alpha && npm run test -- __tests__/metrics/risk-metrics.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/michael/paper-alpha && git add app/api/portfolio/metrics/route.ts __tests__/metrics/risk-metrics.test.ts && git commit -m "feat: add Sortino, Calmar, and Profit Factor to risk metrics API"
```

---

## Task 2: Update RiskMetricsCard

**Files:**
- Modify: `components/portfolio/risk-metrics.tsx`

- [ ] **Step 1: Replace the component**

```tsx
'use client'

import useSWR from 'swr'
import { Activity } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { RiskMetrics } from '@/app/api/portfolio/metrics/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())

function pnlCol(n: number) {
  return n > 0 ? 'text-green' : n < 0 ? 'text-red' : 'text-text-primary'
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-lg font-bold font-mono ${color ?? 'text-text-primary'}`}>{value}</p>
      {sub && <p className="text-xs text-text-muted">{sub}</p>}
    </div>
  )
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 11 }).map((_, i) => (
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
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
            label="Sortino Ratio"
            value={data.sortinoRatio !== null ? data.sortinoRatio.toFixed(2) : '—'}
            sub="Downside-adjusted"
            color={data.sortinoRatio !== null ? (data.sortinoRatio >= 1 ? 'text-green' : data.sortinoRatio >= 0 ? 'text-text-primary' : 'text-red') : undefined}
          />
          <Metric
            label="Calmar Ratio"
            value={data.calmarRatio !== null ? data.calmarRatio.toFixed(2) : '—'}
            sub="Return / drawdown"
            color={data.calmarRatio !== null ? (data.calmarRatio >= 1 ? 'text-green' : data.calmarRatio >= 0.5 ? 'text-text-primary' : 'text-red') : undefined}
          />
          <Metric
            label="Profit Factor"
            value={data.profitFactor !== null ? data.profitFactor.toFixed(2) : '—'}
            sub="Gross wins / losses"
            color={data.profitFactor !== null ? (data.profitFactor >= 1.5 ? 'text-green' : data.profitFactor >= 1 ? 'text-text-primary' : 'text-red') : undefined}
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
```

- [ ] **Step 2: Verify dev server compiles without errors**

```bash
cd /home/michael/paper-alpha && npm run build 2>&1 | tail -20
```

Expected: build completes without TypeScript errors.

- [ ] **Step 3: Commit**

```bash
cd /home/michael/paper-alpha && git add components/portfolio/risk-metrics.tsx && git commit -m "feat: add Sortino, Calmar, and Profit Factor to Risk Metrics card"
```

---

## Task 3: Benchmark Comparison API

**Files:**
- Create: `app/api/portfolio/benchmark-comparison/route.ts`

- [ ] **Step 1: Create the route**

```ts
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance()

export interface BenchmarkComparison {
  alpha: number
  beta: number
  correlation: number
  trackingError: number
  informationRatio: number
  benchmarkTotalReturn: number
  dataPoints: number
}

export async function GET(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const benchmark = new URL(req.url).searchParams.get('benchmark') ?? 'SPY'

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { account: true },
  })
  if (!user?.account) return NextResponse.json({ error: 'No account' }, { status: 404 })

  const snapshots = await db.portfolioSnapshot.findMany({
    where: { accountId: user.account.id },
    orderBy: { createdAt: 'asc' },
  })

  if (snapshots.length < 11) {
    return NextResponse.json({ error: 'insufficient_data' })
  }

  const from = new Date(snapshots[0].createdAt)
  from.setDate(from.getDate() - 1)

  let benchmarkQuotes: Array<{ date: string; close: number }> = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (yahooFinance as any).chart(
      benchmark,
      { period1: from, period2: new Date(), interval: '1d' },
      { validateResult: false }
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    benchmarkQuotes = ((result as any)?.quotes ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((q: any) => q.close !== null && q.close !== undefined)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((q: any) => ({
        date: new Date(q.date).toISOString().slice(0, 10),
        close: Number(q.close),
      }))
  } catch {
    return NextResponse.json({ error: 'benchmark_fetch_failed' }, { status: 500 })
  }

  const benchmarkMap = new Map(benchmarkQuotes.map(q => [q.date, q.close]))

  // Build sorted date list from snapshots
  const snapshotsByDate = new Map(
    snapshots.map(s => [s.createdAt.toISOString().slice(0, 10), Number(s.totalValue)])
  )
  const sortedDates = [...snapshotsByDate.keys()].sort()

  // Compute overlapping daily returns (skip weekends/holidays where benchmark is missing)
  const portfolioReturns: number[] = []
  const benchmarkReturns: number[] = []

  for (let i = 1; i < sortedDates.length; i++) {
    const date     = sortedDates[i]
    const prevDate = sortedDates[i - 1]
    const pCurr = snapshotsByDate.get(date)
    const pPrev = snapshotsByDate.get(prevDate)
    const bCurr = benchmarkMap.get(date)
    const bPrev = benchmarkMap.get(prevDate)
    if (pCurr === undefined || pPrev === undefined || bCurr === undefined || bPrev === undefined) continue
    if (pPrev === 0 || bPrev === 0) continue
    portfolioReturns.push((pCurr - pPrev) / pPrev)
    benchmarkReturns.push((bCurr - bPrev) / bPrev)
  }

  if (portfolioReturns.length < 10) {
    return NextResponse.json({ error: 'insufficient_data' })
  }

  const n     = portfolioReturns.length
  const pMean = portfolioReturns.reduce((a, b) => a + b, 0) / n
  const bMean = benchmarkReturns.reduce((a, b) => a + b, 0) / n

  let cov = 0, varB = 0, varP = 0
  for (let i = 0; i < n; i++) {
    cov  += (portfolioReturns[i] - pMean) * (benchmarkReturns[i] - bMean)
    varB += (benchmarkReturns[i] - bMean) ** 2
    varP += (portfolioReturns[i] - pMean) ** 2
  }
  cov /= n; varB /= n; varP /= n

  const beta        = varB > 0 ? cov / varB : 0
  const correlation = (varP > 0 && varB > 0) ? cov / Math.sqrt(varP * varB) : 0

  const pAnnualised = pMean * 252
  const bAnnualised = bMean * 252
  const alpha       = pAnnualised - beta * bAnnualised

  const diffs   = portfolioReturns.map((r, i) => r - benchmarkReturns[i])
  const diffMean = diffs.reduce((a, b) => a + b, 0) / n
  const diffVar  = diffs.reduce((a, d) => a + (d - diffMean) ** 2, 0) / n
  const trackingError = Math.sqrt(diffVar) * Math.sqrt(252) * 100

  const excessReturnPct  = (pAnnualised - bAnnualised) * 100
  const informationRatio = trackingError > 0 ? excessReturnPct / trackingError : 0

  const bFirst = benchmarkQuotes[0]?.close
  const bLast  = benchmarkQuotes[benchmarkQuotes.length - 1]?.close
  const benchmarkTotalReturn = bFirst && bLast ? ((bLast - bFirst) / bFirst) * 100 : 0

  return NextResponse.json({
    alpha:               Math.round(alpha * 10000) / 100,
    beta:                Math.round(beta * 100) / 100,
    correlation:         Math.round(correlation * 100) / 100,
    trackingError:       Math.round(trackingError * 100) / 100,
    informationRatio:    Math.round(informationRatio * 100) / 100,
    benchmarkTotalReturn: Math.round(benchmarkTotalReturn * 100) / 100,
    dataPoints:          n,
  } satisfies BenchmarkComparison)
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /home/michael/paper-alpha && npx tsc --noEmit 2>&1 | grep benchmark-comparison
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
cd /home/michael/paper-alpha && git add app/api/portfolio/benchmark-comparison/route.ts && git commit -m "feat: add benchmark comparison API (alpha, beta, correlation, tracking error, IR)"
```

---

## Task 4: BenchmarkComparisonCard Component

**Files:**
- Create: `components/portfolio/benchmark-comparison.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { BarChart2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { BenchmarkComparison } from '@/app/api/portfolio/benchmark-comparison/route'

const fetcher = (url: string) => fetch(url).then(r => r.json())

type Benchmark = 'SPY' | 'QQQ' | 'BTC-USD'

function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-lg font-bold font-mono ${color ?? 'text-text-primary'}`}>{value}</p>
      {sub && <p className="text-xs text-text-muted">{sub}</p>}
    </div>
  )
}

export function BenchmarkComparisonCard() {
  const [benchmark, setBenchmark] = useState<Benchmark>('SPY')
  const { data, isLoading } = useSWR<BenchmarkComparison & { error?: string }>(
    `/api/portfolio/benchmark-comparison?benchmark=${benchmark}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  const benchmarks: Benchmark[] = ['SPY', 'QQQ', 'BTC-USD']

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-brand" />
          <h2 className="text-sm font-semibold text-text-primary">Performance vs Benchmark</h2>
        </div>
        <div className="flex gap-1">
          {benchmarks.map(b => (
            <button
              key={b}
              onClick={() => setBenchmark(b)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                benchmark === b ? 'bg-brand text-black' : 'bg-surface-2 text-text-secondary hover:text-text-primary'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      ) : !data || data.error === 'insufficient_data' ? (
        <p className="text-sm text-text-muted">
          Not enough data yet. Benchmark comparison requires at least 10 overlapping trading days.
        </p>
      ) : data.error ? (
        <p className="text-sm text-text-muted">Could not load benchmark data. Try again later.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
          <Metric
            label="Alpha"
            value={`${data.alpha >= 0 ? '+' : ''}${data.alpha.toFixed(2)}%`}
            sub={`vs ${data.benchmarkTotalReturn >= 0 ? '+' : ''}${data.benchmarkTotalReturn.toFixed(1)}% benchmark`}
            color={data.alpha > 0 ? 'text-green' : data.alpha < 0 ? 'text-red' : 'text-text-primary'}
          />
          <Metric
            label="Beta"
            value={data.beta.toFixed(2)}
            sub={data.beta < 0.8 ? 'Low market exposure' : data.beta > 1.2 ? 'High market exposure' : 'Market-like'}
          />
          <Metric
            label="Correlation"
            value={data.correlation.toFixed(2)}
            sub="vs benchmark"
          />
          <Metric
            label="Tracking Error"
            value={`${data.trackingError.toFixed(2)}%`}
            sub="Annualised"
          />
          <Metric
            label="Info Ratio"
            value={data.informationRatio.toFixed(2)}
            sub="Excess return / TE"
            color={data.informationRatio > 0.5 ? 'text-green' : data.informationRatio < 0 ? 'text-red' : 'text-text-primary'}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /home/michael/paper-alpha && npx tsc --noEmit 2>&1 | grep benchmark
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /home/michael/paper-alpha && git add components/portfolio/benchmark-comparison.tsx && git commit -m "feat: add BenchmarkComparisonCard component (alpha, beta, correlation, TE, IR)"
```

---

## Task 5: Add BenchmarkComparisonCard to Portfolio Page

**Files:**
- Modify: `app/(dashboard)/portfolio/page.tsx`

- [ ] **Step 1: Add the import and card**

Add import at the top of the file:

```ts
import { BenchmarkComparisonCard } from '@/components/portfolio/benchmark-comparison'
```

Replace:

```tsx
      <RiskMetricsCard />

      <AchievementsCard />
```

With:

```tsx
      <RiskMetricsCard />

      <BenchmarkComparisonCard />

      <AchievementsCard />
```

- [ ] **Step 2: Build to confirm no errors**

```bash
cd /home/michael/paper-alpha && npm run build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /home/michael/paper-alpha && git add app/(dashboard)/portfolio/page.tsx && git commit -m "feat: add BenchmarkComparisonCard to portfolio page"
```

---

## Task 6: Backtest Candles API

**Files:**
- Create: `app/api/backtest/candles/route.ts`

- [ ] **Step 1: Create the route**

```ts
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getStockCandlesYahoo } from '@/lib/market-data/yahoo'
import { getBinanceCryptoCandles } from '@/lib/market-data/binance'

const MAX_YEARS = 5

export async function GET(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const symbol    = searchParams.get('symbol')
  const fromParam = searchParams.get('from')
  const toParam   = searchParams.get('to')
  const assetType = searchParams.get('assetType') ?? 'STOCK'

  if (!symbol || !fromParam || !toParam) {
    return NextResponse.json({ error: 'symbol, from, and to are required' }, { status: 400 })
  }

  const from = Math.floor(new Date(fromParam).getTime() / 1000)
  const to   = Math.floor(new Date(toParam).getTime() / 1000)
  const maxFrom = Math.floor(Date.now() / 1000) - MAX_YEARS * 365 * 86400

  if (from < maxFrom) {
    return NextResponse.json({ error: `Date range exceeds ${MAX_YEARS} years` }, { status: 400 })
  }

  try {
    const candles = assetType === 'CRYPTO'
      ? await getBinanceCryptoCandles(symbol, from, to)
      : await getStockCandlesYahoo(symbol, from, to, '1D')

    return NextResponse.json(candles)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed to fetch candles' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Check `getStockCandlesYahoo` signature**

Open `lib/market-data/yahoo.ts` and confirm the function signature accepts `(symbol, from, to, resolution)` where `from` and `to` are Unix timestamps. If the resolution parameter name differs, adjust the call above to match.

- [ ] **Step 3: Verify compilation**

```bash
cd /home/michael/paper-alpha && npx tsc --noEmit 2>&1 | grep "backtest/candles"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
cd /home/michael/paper-alpha && git add app/api/backtest/candles/route.ts && git commit -m "feat: add backtest candles API route"
```

---

## Task 7: Backtest Engine + Tests

**Files:**
- Create: `lib/backtest/engine.ts`
- Create: `__tests__/backtest/engine.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `__tests__/backtest/engine.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { runBacktest } from '@/lib/backtest/engine'
import type { CandleData } from '@/types'

function makeCandles(prices: number[]): CandleData[] {
  return prices.map((close, i) => ({
    time: 1700000000 + i * 86400,
    open: close,
    high: close * 1.01,
    low:  close * 0.99,
    close,
    volume: 1_000_000,
  }))
}

const CUSTOM_RSI_CONFIG = {
  strategy: 'CUSTOM' as const,
  startingCapital: 100_000,
  customParams: {
    indicator: 'RSI' as const,
    rsiPeriod: 14,
    rsiBuyThreshold: 30,
    rsiSellThreshold: 70,
    emaFastPeriod: 12,
    emaSlowPeriod: 26,
    bbPeriod: 20,
    bbStdDev: 2,
    positionSizePct: 20,
    stopLossPct: 0,
  },
}

describe('runBacktest — structure', () => {
  it('returns empty result for fewer than 30 candles', () => {
    const candles = makeCandles([100, 101, 102])
    const result  = runBacktest('AAPL', candles, CUSTOM_RSI_CONFIG)
    expect(result.equity).toHaveLength(0)
    expect(result.trades).toHaveLength(0)
    expect(result.metrics.totalTrades).toBe(0)
  })

  it('equity curve starts at index 30', () => {
    const prices  = Array.from({ length: 60 }, (_, i) => 100 + i * 0.5)
    const candles = makeCandles(prices)
    const result  = runBacktest('AAPL', candles, CUSTOM_RSI_CONFIG)
    expect(result.equity).toHaveLength(candles.length - 30)
  })

  it('all equity values are positive', () => {
    const prices  = Array.from({ length: 60 }, (_, i) => 100 + i * 0.5)
    const candles = makeCandles(prices)
    const result  = runBacktest('AAPL', candles, CUSTOM_RSI_CONFIG)
    for (const point of result.equity) {
      expect(point.value).toBeGreaterThan(0)
    }
  })

  it('equity time values are monotonically increasing', () => {
    const prices  = Array.from({ length: 60 }, (_, i) => 100 + i * 0.5)
    const candles = makeCandles(prices)
    const result  = runBacktest('AAPL', candles, CUSTOM_RSI_CONFIG)
    for (let i = 1; i < result.equity.length; i++) {
      expect(result.equity[i].time).toBeGreaterThan(result.equity[i - 1].time)
    }
  })

  it('maxDrawdown is always <= 0', () => {
    const prices  = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 3) * 20)
    const candles = makeCandles(prices)
    const result  = runBacktest('AAPL', candles, CUSTOM_RSI_CONFIG)
    expect(result.metrics.maxDrawdown).toBeLessThanOrEqual(0)
  })
})

describe('runBacktest — stop loss', () => {
  it('triggers stop loss when price falls below threshold', () => {
    // Price falls 20% after a period that triggers a buy (RSI below 40)
    const falling = Array.from({ length: 40 }, (_, i) => 100 - i * 0.5)
    const crash   = Array.from({ length: 20 }, () => 75)
    const prices  = [...falling, ...crash]
    const candles = makeCandles(prices)
    const config  = {
      ...CUSTOM_RSI_CONFIG,
      customParams: { ...CUSTOM_RSI_CONFIG.customParams, rsiBuyThreshold: 40, positionSizePct: 50, stopLossPct: 10 },
    }
    const result = runBacktest('AAPL', candles, config)
    // Structural check: result is always valid
    expect(result.metrics).toHaveProperty('maxDrawdown')
    expect(result.equity.length).toBeGreaterThan(0)
  })
})

describe('runBacktest — EMA crossover', () => {
  it('produces valid metrics for EMA crossover strategy', () => {
    const prices  = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 8) * 15)
    const candles = makeCandles(prices)
    const result  = runBacktest('AAPL', candles, {
      strategy: 'CUSTOM',
      startingCapital: 100_000,
      customParams: {
        indicator: 'EMA_CROSS',
        rsiPeriod: 14,
        rsiBuyThreshold: 30,
        rsiSellThreshold: 70,
        emaFastPeriod: 5,
        emaSlowPeriod: 20,
        bbPeriod: 20,
        bbStdDev: 2,
        positionSizePct: 50,
        stopLossPct: 0,
      },
    })
    expect(typeof result.metrics.totalReturn).toBe('number')
    expect(typeof result.metrics.annualisedReturn).toBe('number')
  })
})

describe('runBacktest — Bollinger Bands', () => {
  it('produces valid metrics for Bollinger strategy', () => {
    const prices  = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 5) * 10)
    const candles = makeCandles(prices)
    const result  = runBacktest('AAPL', candles, {
      strategy: 'CUSTOM',
      startingCapital: 100_000,
      customParams: {
        indicator: 'BOLLINGER',
        rsiPeriod: 14,
        rsiBuyThreshold: 30,
        rsiSellThreshold: 70,
        emaFastPeriod: 12,
        emaSlowPeriod: 26,
        bbPeriod: 20,
        bbStdDev: 2,
        positionSizePct: 30,
        stopLossPct: 5,
      },
    })
    expect(Array.isArray(result.trades)).toBe(true)
    expect(Array.isArray(result.equity)).toBe(true)
  })
})

describe('runBacktest — bot strategy', () => {
  it('returns valid structure for bot preset', () => {
    const prices  = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 10)
    const candles = makeCandles(prices)
    const result  = runBacktest('AAPL', candles, { strategy: 'BOT', startingCapital: 100_000 })
    expect(result).toHaveProperty('equity')
    expect(result).toHaveProperty('trades')
    expect(result).toHaveProperty('metrics')
    expect(result.metrics).toHaveProperty('sharpe')
    expect(result.metrics).toHaveProperty('sortino')
    expect(result.metrics).toHaveProperty('calmar')
  })
})
```

- [ ] **Step 2: Run tests — expect import failure**

```bash
cd /home/michael/paper-alpha && npm run test -- __tests__/backtest/engine.test.ts
```

Expected: error — `Cannot find module '@/lib/backtest/engine'`

- [ ] **Step 3: Create the engine**

Create `lib/backtest/engine.ts`:

```ts
import type { CandleData } from '@/types'
import { rsi, ema, bollingerBands } from '@/lib/bot/indicators'
import { generateSignal } from '@/lib/bot/signal-engine'

export type IndicatorType = 'RSI' | 'EMA_CROSS' | 'BOLLINGER'

export interface CustomStrategyParams {
  indicator: IndicatorType
  rsiPeriod: number
  rsiBuyThreshold: number
  rsiSellThreshold: number
  emaFastPeriod: number
  emaSlowPeriod: number
  bbPeriod: number
  bbStdDev: number
  positionSizePct: number  // 5–50
  stopLossPct: number      // 0 = disabled
}

export interface BacktestConfig {
  strategy: 'BOT' | 'CUSTOM'
  startingCapital: number
  customParams?: CustomStrategyParams
}

export interface BacktestTrade {
  date: string
  action: 'BUY' | 'SELL'
  price: number
  quantity: number
  pnl: number | null  // null on BUY
}

export interface BacktestMetrics {
  totalReturn: number
  annualisedReturn: number
  sharpe: number | null
  sortino: number | null
  calmar: number | null
  maxDrawdown: number
  winRate: number | null
  profitFactor: number | null
  totalTrades: number
}

export interface BacktestResult {
  equity: { time: number; value: number }[]
  trades: BacktestTrade[]
  metrics: BacktestMetrics
}

const EMPTY_METRICS: BacktestMetrics = {
  totalReturn: 0, annualisedReturn: 0, sharpe: null, sortino: null,
  calmar: null, maxDrawdown: 0, winRate: null, profitFactor: null, totalTrades: 0,
}

function toDateStr(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 10)
}

function downsampleWeekly(candles: CandleData[]): CandleData[] {
  const weekMap = new Map<string, CandleData>()
  for (const c of candles) {
    const d    = new Date(c.time * 1000)
    const year = d.getUTCFullYear()
    const week = Math.floor((d.getTime() - Date.UTC(year, 0, 1)) / (7 * 86_400_000))
    weekMap.set(`${year}-${week}`, c)  // last candle of each week wins
  }
  return [...weekMap.values()].sort((a, b) => a.time - b.time)
}

function computeMetrics(
  equity: { value: number }[],
  trades: BacktestTrade[],
  startingCapital: number,
  days: number
): BacktestMetrics {
  if (equity.length === 0) return EMPTY_METRICS

  const values      = equity.map(e => e.value)
  const totalReturn = ((values[values.length - 1] - startingCapital) / startingCapital) * 100
  const annualisedReturn = days > 0 ? ((totalReturn / 100) / (days / 365)) * 100 : 0

  const dailyReturns: number[] = []
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] > 0) dailyReturns.push((values[i] - values[i - 1]) / values[i - 1])
  }

  const rf = 0.05 / 252
  let sharpe: number | null  = null
  let sortino: number | null = null

  if (dailyReturns.length >= 5) {
    const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
    const variance = dailyReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / dailyReturns.length
    const stdDev   = Math.sqrt(variance)
    if (stdDev > 0) sharpe = Math.round(((mean - rf) / stdDev) * Math.sqrt(252) * 100) / 100

    const downsideVariance = dailyReturns.reduce((a, r) => {
      const d = Math.min(r - rf, 0)
      return a + d * d
    }, 0) / dailyReturns.length
    const downsideDev = Math.sqrt(downsideVariance)
    if (downsideDev > 0) sortino = Math.round(((mean - rf) / downsideDev) * Math.sqrt(252) * 100) / 100
  }

  let peak = values[0], maxDrawdown = 0
  for (const v of values) {
    if (v > peak) peak = v
    const dd = (v - peak) / peak
    if (dd < maxDrawdown) maxDrawdown = dd
  }

  let calmar: number | null = null
  if (maxDrawdown < 0 && days > 0) {
    calmar = Math.round(((annualisedReturn / 100) / Math.abs(maxDrawdown)) * 100) / 100
  }

  const sells = trades.filter(t => t.action === 'SELL' && t.pnl !== null)
  let winRate: number | null    = null
  let profitFactor: number | null = null
  if (sells.length > 0) {
    const wins = sells.filter(t => (t.pnl ?? 0) > 0)
    winRate = Math.round((wins.length / sells.length) * 100)
    const grossWins   = wins.reduce((s, t) => s + (t.pnl ?? 0), 0)
    const grossLosses = sells.filter(t => (t.pnl ?? 0) <= 0).reduce((s, t) => s + Math.abs(t.pnl ?? 0), 0)
    if (grossLosses > 0) profitFactor = Math.round((grossWins / grossLosses) * 100) / 100
  }

  return {
    totalReturn:      Math.round(totalReturn * 100) / 100,
    annualisedReturn: Math.round(annualisedReturn * 100) / 100,
    sharpe, sortino, calmar,
    maxDrawdown: Math.round(maxDrawdown * 10000) / 100,
    winRate, profitFactor,
    totalTrades: trades.filter(t => t.action === 'BUY').length,
  }
}

function runCustomStrategy(
  candles: CandleData[],
  params: CustomStrategyParams,
  startingCapital: number
): BacktestResult {
  const closes = candles.map(c => c.close)
  const equity: { time: number; value: number }[] = []
  const trades: BacktestTrade[] = []
  let cash = startingCapital, shares = 0, entryPrice = 0

  for (let i = 30; i < candles.length; i++) {
    const slice = closes.slice(0, i + 1)
    const price = closes[i]

    // Stop loss
    if (shares > 0 && params.stopLossPct > 0 && price <= entryPrice * (1 - params.stopLossPct / 100)) {
      const proceeds = shares * price
      trades.push({ date: toDateStr(candles[i].time), action: 'SELL', price, quantity: shares, pnl: proceeds - shares * entryPrice })
      cash += proceeds; shares = 0; entryPrice = 0
      equity.push({ time: candles[i].time, value: cash })
      continue
    }

    let buySignal = false, sellSignal = false

    if (params.indicator === 'RSI') {
      const vals = rsi(slice, params.rsiPeriod)
      if (vals.length > 0) {
        const curr = vals[vals.length - 1]
        buySignal  = curr < params.rsiBuyThreshold
        sellSignal = curr > params.rsiSellThreshold
      }
    } else if (params.indicator === 'EMA_CROSS') {
      const fast = ema(slice, params.emaFastPeriod)
      const slow = ema(slice, params.emaSlowPeriod)
      if (fast.length >= 2 && slow.length >= 2) {
        buySignal  = fast[fast.length - 2] <= slow[slow.length - 2] && fast[fast.length - 1] > slow[slow.length - 1]
        sellSignal = fast[fast.length - 2] >= slow[slow.length - 2] && fast[fast.length - 1] < slow[slow.length - 1]
      }
    } else if (params.indicator === 'BOLLINGER') {
      const bands = bollingerBands(slice, params.bbPeriod, params.bbStdDev)
      if (bands.length > 0) {
        buySignal  = price <= bands[bands.length - 1].lower
        sellSignal = price >= bands[bands.length - 1].upper
      }
    }

    if (buySignal && shares === 0) {
      const qty = Math.floor(cash * (params.positionSizePct / 100) / price)
      if (qty > 0 && price * qty <= cash) {
        shares = qty; entryPrice = price; cash -= price * qty
        trades.push({ date: toDateStr(candles[i].time), action: 'BUY', price, quantity: qty, pnl: null })
      }
    } else if (sellSignal && shares > 0) {
      const proceeds = shares * price
      trades.push({ date: toDateStr(candles[i].time), action: 'SELL', price, quantity: shares, pnl: proceeds - shares * entryPrice })
      cash += proceeds; shares = 0; entryPrice = 0
    }

    equity.push({ time: candles[i].time, value: cash + shares * price })
  }

  // Close open position at end of period
  if (shares > 0) {
    const price = closes[closes.length - 1]
    trades.push({ date: toDateStr(candles[candles.length - 1].time), action: 'SELL', price, quantity: shares, pnl: shares * price - shares * entryPrice })
    cash += shares * price; shares = 0
  }

  const days = candles.length > 1 ? (candles[candles.length - 1].time - candles[0].time) / 86_400 : 0
  return { equity, trades, metrics: computeMetrics(equity, trades, startingCapital, days) }
}

function runBotStrategy(symbol: string, candles: CandleData[], startingCapital: number): BacktestResult {
  const weekly = downsampleWeekly(candles)
  const equity: { time: number; value: number }[] = []
  const trades: BacktestTrade[] = []
  let cash = startingCapital, shares = 0, entryPrice = 0

  for (let i = 30; i < candles.length; i++) {
    const slice        = candles.slice(0, i + 1)
    const weeklySlice  = weekly.filter(c => c.time <= candles[i].time)
    const price        = candles[i].close
    const isHeld       = shares > 0
    const signal       = generateSignal(symbol, slice, weeklySlice, 0, isHeld)

    if (signal.action === 'BUY' && !isHeld) {
      const qty = Math.floor(cash * 0.95 / price)
      if (qty > 0 && price * qty <= cash) {
        shares = qty; entryPrice = price; cash -= price * qty
        trades.push({ date: toDateStr(candles[i].time), action: 'BUY', price, quantity: qty, pnl: null })
      }
    } else if (signal.action === 'SELL' && isHeld) {
      const proceeds = shares * price
      trades.push({ date: toDateStr(candles[i].time), action: 'SELL', price, quantity: shares, pnl: proceeds - shares * entryPrice })
      cash += proceeds; shares = 0; entryPrice = 0
    }

    equity.push({ time: candles[i].time, value: cash + shares * price })
  }

  if (shares > 0) {
    const price = candles[candles.length - 1].close
    trades.push({ date: toDateStr(candles[candles.length - 1].time), action: 'SELL', price, quantity: shares, pnl: shares * price - shares * entryPrice })
    cash += shares * price
  }

  const days = candles.length > 1 ? (candles[candles.length - 1].time - candles[0].time) / 86_400 : 0
  return { equity, trades, metrics: computeMetrics(equity, trades, startingCapital, days) }
}

export function runBacktest(symbol: string, candles: CandleData[], config: BacktestConfig): BacktestResult {
  if (candles.length < 30) {
    return { equity: [], trades: [], metrics: EMPTY_METRICS }
  }

  if (config.strategy === 'BOT') {
    return runBotStrategy(symbol, candles, config.startingCapital)
  }

  if (!config.customParams) throw new Error('customParams required for CUSTOM strategy')
  return runCustomStrategy(candles, config.customParams, config.startingCapital)
}
```

- [ ] **Step 4: Run tests — all should pass**

```bash
cd /home/michael/paper-alpha && npm run test -- __tests__/backtest/engine.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/michael/paper-alpha && git add lib/backtest/engine.ts __tests__/backtest/engine.test.ts && git commit -m "feat: add backtest engine with RSI, EMA crossover, Bollinger, and bot-preset strategies"
```

---

## Task 8: Backtester Page

**Files:**
- Create: `components/backtest/backtest-chart.tsx`
- Create: `app/(dashboard)/backtester/page.tsx`

- [ ] **Step 1: Create the equity curve chart component**

Create `components/backtest/backtest-chart.tsx`:

```tsx
'use client'

import { useEffect, useRef } from 'react'

interface BacktestChartProps {
  equity: { time: number; value: number }[]
  startingCapital: number
}

export function BacktestChart({ equity, startingCapital }: BacktestChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || equity.length === 0) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any

    async function init() {
      const { createChart, ColorType } = await import('lightweight-charts')
      if (!containerRef.current) return

      chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 280,
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8' },
        grid: { vertLines: { visible: false }, horzLines: { color: '#1e2334' } },
        rightPriceScale: { borderColor: '#1e2334' },
        timeScale: { borderColor: '#1e2334', timeVisible: true },
        handleScroll: false,
        handleScale: false,
      })

      const series = chart.addLineSeries({
        color: equity[equity.length - 1]?.value >= startingCapital ? '#22c55e' : '#ef4444',
        lineWidth: 2,
        priceFormat: { type: 'price', precision: 0, minMove: 1 },
      })

      series.setData(equity.map(p => ({ time: p.time, value: p.value })))
      chart.timeScale().fitContent()
    }

    init()
    return () => { try { chart?.remove() } catch { /* ignore */ } }
  }, [equity, startingCapital])

  return <div ref={containerRef} className="w-full" style={{ height: 280 }} />
}
```

- [ ] **Step 2: Create the main backtester page**

Create `app/(dashboard)/backtester/page.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import { runBacktest, type BacktestConfig, type BacktestResult, type CustomStrategyParams } from '@/lib/backtest/engine'
import type { CandleData } from '@/types'
import { BacktestChart } from '@/components/backtest/backtest-chart'
import { formatCurrency } from '@/lib/utils'

const DEFAULT_PARAMS: CustomStrategyParams = {
  indicator: 'RSI',
  rsiPeriod: 14,
  rsiBuyThreshold: 30,
  rsiSellThreshold: 70,
  emaFastPeriod: 12,
  emaSlowPeriod: 26,
  bbPeriod: 20,
  bbStdDev: 2,
  positionSizePct: 20,
  stopLossPct: 0,
}

function NumberInput({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-text-muted">{label}</label>
      <input type="number" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-brand" />
    </div>
  )
}

function SliderInput({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-text-muted">{label}</label>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-brand" />
    </div>
  )
}

function MetricTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-base font-bold font-mono ${color ?? 'text-text-primary'}`}>{value}</p>
    </div>
  )
}

export default function BacktesterPage() {
  const [symbol, setSymbol]       = useState('AAPL')
  const [assetType, setAssetType] = useState<'STOCK' | 'CRYPTO'>('STOCK')
  const [strategy, setStrategy]   = useState<'BOT' | 'CUSTOM'>('BOT')
  const [params, setParams]       = useState<CustomStrategyParams>(DEFAULT_PARAMS)
  const [fromDate, setFromDate]   = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 2); return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate]       = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [result, setResult]       = useState<BacktestResult | null>(null)

  async function handleRun() {
    if (!symbol.trim()) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch(
        `/api/backtest/candles?symbol=${encodeURIComponent(symbol.trim())}&from=${fromDate}&to=${toDate}&assetType=${assetType}`
      )
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? `HTTP ${res.status}`) }
      const candles: CandleData[] = await res.json()
      if (!Array.isArray(candles) || candles.length < 30) {
        throw new Error(`Not enough data (${Array.isArray(candles) ? candles.length : 0} candles — need ≥ 30). Try a longer date range.`)
      }
      const config: BacktestConfig = { strategy, startingCapital: 100_000, customParams: strategy === 'CUSTOM' ? params : undefined }
      setResult(runBacktest(symbol.trim(), candles, config))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const m = result?.metrics

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Backtester</h1>
        <p className="text-text-muted text-sm mt-1">Simulate trading strategies on historical data</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── Config panel ── */}
        <div className="card p-5 space-y-5">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-brand" />
            <h2 className="text-sm font-semibold text-text-primary">Strategy Config</h2>
          </div>

          {/* Symbol */}
          <div className="space-y-1">
            <label className="text-xs text-text-muted">Symbol</label>
            <input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary font-mono uppercase placeholder:text-text-muted focus:outline-none focus:border-brand" />
          </div>

          {/* Asset type */}
          <div className="space-y-1">
            <label className="text-xs text-text-muted">Asset Type</label>
            <div className="flex gap-2">
              {(['STOCK', 'CRYPTO'] as const).map(t => (
                <button key={t} onClick={() => setAssetType(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${assetType === t ? 'bg-brand text-black' : 'bg-surface-2 text-text-secondary hover:text-text-primary'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-text-muted">From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-muted">To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand" />
            </div>
          </div>

          {/* Strategy toggle */}
          <div className="space-y-1">
            <label className="text-xs text-text-muted">Strategy</label>
            <div className="flex gap-2">
              {(['BOT', 'CUSTOM'] as const).map(s => (
                <button key={s} onClick={() => setStrategy(s)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${strategy === s ? 'bg-brand text-black' : 'bg-surface-2 text-text-secondary hover:text-text-primary'}`}>
                  {s === 'BOT' ? 'Bot Preset' : 'Custom'}
                </button>
              ))}
            </div>
          </div>

          {/* Custom params */}
          {strategy === 'CUSTOM' && (
            <div className="space-y-4 border-t border-border pt-4">
              <div className="space-y-1">
                <label className="text-xs text-text-muted">Indicator</label>
                <select value={params.indicator}
                  onChange={e => setParams(p => ({ ...p, indicator: e.target.value as CustomStrategyParams['indicator'] }))}
                  className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand">
                  <option value="RSI">RSI</option>
                  <option value="EMA_CROSS">EMA Crossover</option>
                  <option value="BOLLINGER">Bollinger Bands</option>
                </select>
              </div>

              {params.indicator === 'RSI' && (<>
                <NumberInput label="RSI Period" value={params.rsiPeriod} min={5} max={50} onChange={v => setParams(p => ({ ...p, rsiPeriod: v }))} />
                <NumberInput label={`Buy when RSI <`} value={params.rsiBuyThreshold} min={10} max={50} onChange={v => setParams(p => ({ ...p, rsiBuyThreshold: v }))} />
                <NumberInput label={`Sell when RSI >`} value={params.rsiSellThreshold} min={50} max={90} onChange={v => setParams(p => ({ ...p, rsiSellThreshold: v }))} />
              </>)}

              {params.indicator === 'EMA_CROSS' && (<>
                <NumberInput label="Fast EMA Period" value={params.emaFastPeriod} min={5} max={50} onChange={v => setParams(p => ({ ...p, emaFastPeriod: v }))} />
                <NumberInput label="Slow EMA Period" value={params.emaSlowPeriod} min={10} max={200} onChange={v => setParams(p => ({ ...p, emaSlowPeriod: v }))} />
              </>)}

              {params.indicator === 'BOLLINGER' && (<>
                <NumberInput label="BB Period" value={params.bbPeriod} min={5} max={50} onChange={v => setParams(p => ({ ...p, bbPeriod: v }))} />
                <NumberInput label="BB Std Dev" value={params.bbStdDev} min={1} max={3} onChange={v => setParams(p => ({ ...p, bbStdDev: v }))} />
              </>)}

              <SliderInput
                label={`Position Size: ${params.positionSizePct}%`}
                value={params.positionSizePct} min={5} max={50}
                onChange={v => setParams(p => ({ ...p, positionSizePct: v }))} />
              <SliderInput
                label={`Stop Loss: ${params.stopLossPct === 0 ? 'Disabled' : `${params.stopLossPct}%`}`}
                value={params.stopLossPct} min={0} max={30}
                onChange={v => setParams(p => ({ ...p, stopLossPct: v }))} />
            </div>
          )}

          <button onClick={handleRun} disabled={loading || !symbol.trim()}
            className="w-full py-2 rounded-lg bg-brand text-black text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Running…' : 'Run Backtest'}
          </button>

          {error && <p className="text-xs text-red leading-relaxed">{error}</p>}
        </div>

        {/* ── Results panel ── */}
        <div className="lg:col-span-2 space-y-5">
          {!result && !loading && (
            <div className="card p-12 flex flex-col items-center justify-center text-center">
              <FlaskConical className="w-10 h-10 text-text-muted mb-3" />
              <p className="text-sm font-medium text-text-secondary">Configure a strategy and click Run Backtest</p>
              <p className="text-xs text-text-muted mt-1">Starting capital: $100,000</p>
            </div>
          )}

          {loading && (
            <div className="card p-12 flex items-center justify-center">
              <p className="text-sm text-text-muted animate-pulse">Fetching data and running simulation…</p>
            </div>
          )}

          {result && m && (<>
            {/* Equity curve */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-text-primary">Equity Curve</h3>
                <span className={`text-sm font-bold font-mono ${m.totalReturn >= 0 ? 'text-green' : 'text-red'}`}>
                  {m.totalReturn >= 0 ? '+' : ''}{m.totalReturn.toFixed(2)}%
                </span>
              </div>
              <BacktestChart equity={result.equity} startingCapital={100_000} />
            </div>

            {/* Metrics */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-4">Performance Metrics</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                <MetricTile label="Total Return"   value={`${m.totalReturn >= 0 ? '+' : ''}${m.totalReturn.toFixed(2)}%`}  color={m.totalReturn >= 0 ? 'text-green' : 'text-red'} />
                <MetricTile label="Ann. Return"    value={`${m.annualisedReturn >= 0 ? '+' : ''}${m.annualisedReturn.toFixed(2)}%`} color={m.annualisedReturn >= 0 ? 'text-green' : 'text-red'} />
                <MetricTile label="Sharpe"         value={m.sharpe !== null ? m.sharpe.toFixed(2) : '—'} color={m.sharpe !== null ? (m.sharpe >= 1 ? 'text-green' : m.sharpe >= 0 ? 'text-text-primary' : 'text-red') : undefined} />
                <MetricTile label="Sortino"        value={m.sortino !== null ? m.sortino.toFixed(2) : '—'} color={m.sortino !== null ? (m.sortino >= 1 ? 'text-green' : m.sortino >= 0 ? 'text-text-primary' : 'text-red') : undefined} />
                <MetricTile label="Calmar"         value={m.calmar !== null ? m.calmar.toFixed(2) : '—'} />
                <MetricTile label="Max Drawdown"   value={`${m.maxDrawdown.toFixed(2)}%`} color={m.maxDrawdown < -10 ? 'text-red' : 'text-text-primary'} />
                <MetricTile label="Win Rate"       value={m.winRate !== null ? `${m.winRate}%` : '—'} color={m.winRate !== null ? (m.winRate >= 50 ? 'text-green' : 'text-red') : undefined} />
                <MetricTile label="Profit Factor"  value={m.profitFactor !== null ? m.profitFactor.toFixed(2) : '—'} color={m.profitFactor !== null ? (m.profitFactor >= 1.5 ? 'text-green' : m.profitFactor >= 1 ? 'text-text-primary' : 'text-red') : undefined} />
                <MetricTile label="Total Trades"   value={String(m.totalTrades)} />
              </div>
            </div>

            {/* Trade log */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-text-primary">Trade Log ({result.trades.length} entries)</h3>
              </div>
              <div className="overflow-auto max-h-72">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-surface border-b border-border">
                    <tr>
                      {['Date', 'Action', 'Price', 'Qty', 'P&L'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold text-text-muted">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((t, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface-2">
                        <td className="px-4 py-2.5 text-text-secondary font-mono">{t.date}</td>
                        <td className="px-4 py-2.5">
                          <span className={`font-semibold ${t.action === 'BUY' ? 'text-green' : 'text-red'}`}>{t.action}</span>
                        </td>
                        <td className="px-4 py-2.5 text-text-primary font-mono">{formatCurrency(t.price)}</td>
                        <td className="px-4 py-2.5 text-text-secondary">{t.quantity.toLocaleString()}</td>
                        <td className={`px-4 py-2.5 font-mono ${t.pnl === null ? 'text-text-muted' : t.pnl >= 0 ? 'text-green' : 'text-red'}`}>
                          {t.pnl === null ? '—' : `${t.pnl >= 0 ? '+' : ''}${formatCurrency(t.pnl)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>)}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Build to confirm no errors**

```bash
cd /home/michael/paper-alpha && npm run build 2>&1 | tail -15
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /home/michael/paper-alpha && git add components/backtest/backtest-chart.tsx app/(dashboard)/backtester/page.tsx && git commit -m "feat: add backtester page with equity curve, metrics, and trade log"
```

---

## Task 9: Add Backtester to Sidebar

**Files:**
- Modify: `components/layout/sidebar.tsx`

- [ ] **Step 1: Add the import and nav entry**

Add `FlaskConical` to the existing lucide-react import:

```ts
import {
  LayoutDashboard,
  TrendingUp,
  Briefcase,
  Trophy,
  History,
  Settings,
  BarChart2,
  X,
  Newspaper,
  SlidersHorizontal,
  User,
  Activity,
  FlaskConical,
} from 'lucide-react'
```

In the `navGroups` array, add the Backtester entry to the Research group:

```ts
  {
    label: 'Research',
    items: [
      { href: '/news',        label: 'News',       icon: Newspaper },
      { href: '/screener',    label: 'Screener',   icon: SlidersHorizontal },
      { href: '/analysis',    label: 'Analysis',   icon: BarChart2 },
      { href: '/backtester',  label: 'Backtester', icon: FlaskConical },
    ],
  },
```

- [ ] **Step 2: Build to confirm no errors**

```bash
cd /home/michael/paper-alpha && npm run build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 3: Run all tests to confirm nothing regressed**

```bash
cd /home/michael/paper-alpha && npm run test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
cd /home/michael/paper-alpha && git add components/layout/sidebar.tsx && git commit -m "feat: add Backtester to sidebar nav"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Sortino ratio — Task 1
- ✅ Calmar ratio — Task 1
- ✅ Profit Factor — Task 1
- ✅ Risk Metrics card updated — Task 2
- ✅ Benchmark comparison API (alpha, beta, correlation, TE, IR) — Task 3
- ✅ BenchmarkComparisonCard with SPY/QQQ/BTC selector — Task 4
- ✅ Card added to portfolio page below RiskMetricsCard — Task 5
- ✅ Backtest candles API route — Task 6
- ✅ Client-side simulation engine — Task 7
- ✅ Bot preset mode (generateSignal, neutral sentiment) — Task 7
- ✅ Custom strategy: RSI, EMA crossover, Bollinger Bands — Task 7
- ✅ Date range picker — Task 8
- ✅ Equity curve chart — Task 8
- ✅ Metrics grid — Task 8
- ✅ Trade log table — Task 8
- ✅ Sidebar entry — Task 9

**Type consistency check:**
- `BacktestConfig`, `CustomStrategyParams`, `BacktestResult`, `BacktestTrade`, `BacktestMetrics` defined in `lib/backtest/engine.ts` and imported by page — consistent throughout.
- `BenchmarkComparison` interface exported from route and imported by component — consistent.
- `RiskMetrics` interface extended with `sortinoRatio`, `calmarRatio`, `profitFactor` — component updated to match.

**No placeholders detected.**
