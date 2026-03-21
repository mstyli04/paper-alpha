'use client'

import { useEffect, useRef } from 'react'
import type { PortfolioSnapshot } from '@/types'

interface PortfolioChartProps {
  snapshots: PortfolioSnapshot[]
  startingBalance: number
  height?: number
}

export function PortfolioChart({ snapshots, startingBalance, height = 200 }: PortfolioChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || !snapshots.length) return

    let chart: ReturnType<typeof import('lightweight-charts')['createChart']>

    async function init() {
      const { createChart, ColorType } = await import('lightweight-charts')
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

      // Add starting point
      const firstDate = new Date(snapshots[0]?.createdAt || Date.now())
      firstDate.setDate(firstDate.getDate() - 1)

      const chartData = [
        { time: Math.floor(firstDate.getTime() / 1000) as unknown as import('lightweight-charts').UTCTimestamp, value: startingBalance },
        ...snapshots.map(s => ({
          time: Math.floor(new Date(s.createdAt).getTime() / 1000) as unknown as import('lightweight-charts').UTCTimestamp,
          value: s.totalValue,
        })),
      ]

      series.setData(chartData)
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
  }, [snapshots, startingBalance, height])

  if (!snapshots.length) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-text-muted text-sm"
      >
        Make your first trade to see performance charts
      </div>
    )
  }

  return <div ref={containerRef} className="w-full" style={{ height }} />
}
