'use client'

import { useEffect, useRef, useState } from 'react'
import type { PortfolioSnapshot } from '@/types'

interface BenchmarkPoint {
  time: number
  close: number
}

interface PortfolioChartProps {
  snapshots: PortfolioSnapshot[]
  startingBalance: number
  height?: number
  showBenchmark?: boolean
}

export function PortfolioChart({ snapshots, startingBalance, height = 200, showBenchmark = false }: PortfolioChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [benchmark, setBenchmark] = useState<BenchmarkPoint[]>([])
  const [activeBenchmark, setActiveBenchmark] = useState<'SPY' | 'QQQ' | 'BTC-USD'>('SPY')

  useEffect(() => {
    if (!showBenchmark || !snapshots.length) return
    const firstDate = new Date(snapshots[0]?.createdAt || Date.now())
    firstDate.setDate(firstDate.getDate() - 1)
    fetch(`/api/market/benchmark?symbol=${activeBenchmark}&from=${firstDate.toISOString()}`)
      .then(r => r.json())
      .then(data => Array.isArray(data) ? setBenchmark(data) : setBenchmark([]))
      .catch(() => setBenchmark([]))
  }, [showBenchmark, activeBenchmark, snapshots])

  useEffect(() => {
    if (!containerRef.current || !snapshots.length) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any

    async function init() {
      const { createChart, ColorType, LineStyle } = await import('lightweight-charts')
      if (!containerRef.current) return

      chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#94a3b8',
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { color: '#1e2334' },
        },
        rightPriceScale: { borderColor: '#1e2334' },
        timeScale: { borderColor: '#1e2334', timeVisible: true },
        handleScroll: false,
        handleScale: false,
      })

      const lastValue = snapshots[snapshots.length - 1]?.totalValue ?? startingBalance
      const isPositive = lastValue >= startingBalance
      const lineColor = isPositive ? '#10b981' : '#ef4444'

      const series = chart.addAreaSeries({
        lineColor,
        topColor: `${lineColor}22`,
        bottomColor: 'transparent',
        lineWidth: 2,
      })

      const firstSnapshotDate = new Date(snapshots[0]?.createdAt || Date.now())
      firstSnapshotDate.setDate(firstSnapshotDate.getDate() - 1)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chartData: any[] = [
        { time: Math.floor(firstSnapshotDate.getTime() / 1000), value: startingBalance },
        ...snapshots.map(s => ({
          time: Math.floor(new Date(s.createdAt).getTime() / 1000),
          value: s.totalValue,
        })),
      ]

      series.setData(chartData)

      // Benchmark overlay — normalised to same starting value
      if (showBenchmark && benchmark.length >= 2) {
        const firstClose = benchmark[0].close
        const normalised = benchmark.map(p => ({
          time: p.time,
          value: (p.close / firstClose) * startingBalance,
        }))

        const benchSeries = chart.addLineSeries({
          color: '#64748b',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        })
        benchSeries.setData(normalised)
      }

      chart.timeScale().fitContent()
    }

    init()

    const observer = new ResizeObserver(() => {
      if (containerRef.current && chart) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      chart?.remove()
    }
  }, [snapshots, startingBalance, height, showBenchmark, benchmark])

  if (!snapshots.length) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-text-muted text-sm">
        Make your first trade to see performance charts
      </div>
    )
  }

  return (
    <div>
      {showBenchmark && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-xs text-text-muted">Compare vs</span>
          {(['SPY', 'QQQ', 'BTC-USD'] as const).map(b => (
            <button
              key={b}
              onClick={() => setActiveBenchmark(b)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                activeBenchmark === b
                  ? 'border-brand/40 text-brand bg-brand/10'
                  : 'border-border text-text-muted hover:text-text-primary'
              }`}
            >
              {b === 'BTC-USD' ? 'BTC' : b}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-0.5 bg-green inline-block rounded" />
              Portfolio
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-5 h-px border-t border-dashed border-[#64748b] inline-block" />
              {activeBenchmark === 'BTC-USD' ? 'BTC' : activeBenchmark}
            </span>
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full" style={{ height }} />
    </div>
  )
}
