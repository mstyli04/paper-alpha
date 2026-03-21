'use client'

import { useEffect, useRef } from 'react'
import type { CandleData } from '@/types'

interface PriceChartProps {
  data: CandleData[]
  type?: 'line' | 'area' | 'candlestick'
  height?: number
}

export function PriceChart({ data, type = 'area', height = 300 }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<unknown>(null)

  useEffect(() => {
    if (!containerRef.current || !data.length) return

    let chart: ReturnType<typeof import('lightweight-charts')['createChart']>

    async function init() {
      const { createChart, ColorType, CrosshairMode } = await import('lightweight-charts')

      if (!containerRef.current) return

      chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#94a3b8',
        },
        grid: {
          vertLines: { color: '#1e2334' },
          horzLines: { color: '#1e2334' },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: {
          borderColor: '#1e2334',
          textColor: '#94a3b8',
        },
        timeScale: {
          borderColor: '#1e2334',
          timeVisible: true,
          secondsVisible: false,
        },
      })

      chartRef.current = chart

      const isPositive = data.length > 1 ? data[data.length - 1].close >= data[0].close : true
      const upColor = '#10b981'
      const downColor = '#ef4444'
      const lineColor = isPositive ? upColor : downColor

      if (type === 'candlestick') {
        const series = chart.addCandlestickSeries({
          upColor,
          downColor,
          borderUpColor: upColor,
          borderDownColor: downColor,
          wickUpColor: upColor,
          wickDownColor: downColor,
        })
        series.setData(data.map(d => ({
          time: d.time as number,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        })))
      } else {
        const series = chart.addAreaSeries({
          lineColor,
          topColor: `${lineColor}22`,
          bottomColor: 'transparent',
          lineWidth: 2,
        })
        series.setData(data.map(d => ({ time: d.time as number, value: d.close })))
      }

      chart.timeScale().fitContent()
    }

    init()

    const observer = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        (chartRef.current as { applyOptions: (o: unknown) => void }).applyOptions({
          width: containerRef.current.clientWidth,
        })
      }
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      if (chartRef.current) {
        (chartRef.current as { remove: () => void }).remove()
      }
    }
  }, [data, type, height])

  return <div ref={containerRef} className="w-full" style={{ height }} />
}
