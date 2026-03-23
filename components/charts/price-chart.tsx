'use client'

import { useEffect, useRef } from 'react'
import type { CandleData } from '@/types'

export interface TradeMarker {
  time: number  // unix seconds
  side: 'BUY' | 'SELL'
  price: number
  quantity: number
}

interface PriceChartProps {
  data: CandleData[]
  type?: 'line' | 'area' | 'candlestick'
  height?: number
  trades?: TradeMarker[]
}

export function PriceChart({ data, type = 'area', height = 300, trades }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || !data.length) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any

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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let series: any

      if (type === 'candlestick') {
        series = chart.addCandlestickSeries({
          upColor,
          downColor,
          borderUpColor: upColor,
          borderDownColor: downColor,
          wickUpColor: upColor,
          wickDownColor: downColor,
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        series.setData(data.map((d: any) => ({
          time: d.time,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
        })))
      } else {
        series = chart.addAreaSeries({
          lineColor,
          topColor: `${lineColor}22`,
          bottomColor: 'transparent',
          lineWidth: 2,
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        series.setData(data.map((d: any) => ({ time: d.time, value: d.close })))
      }

      // Snap trade markers to the nearest candle time and render them
      if (trades && trades.length > 0) {
        const candleTimes = data.map(d => d.time)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const markers: any[] = trades
          .map(trade => {
            // Find nearest candle time
            let nearest = candleTimes[0]
            let minDiff = Math.abs(trade.time - nearest)
            for (const t of candleTimes) {
              const diff = Math.abs(trade.time - t)
              if (diff < minDiff) { minDiff = diff; nearest = t }
            }
            return {
              time: nearest,
              position: trade.side === 'BUY' ? 'belowBar' : 'aboveBar',
              color: trade.side === 'BUY' ? '#10b981' : '#ef4444',
              shape: trade.side === 'BUY' ? 'arrowUp' : 'arrowDown',
              text: trade.side === 'BUY' ? `B ${trade.quantity}` : `S ${trade.quantity}`,
            }
          })
          // deduplicate by time+side (keep last per time slot to avoid duplicate time errors)
          .sort((a, b) => (a.time as number) - (b.time as number))

        // lightweight-charts requires markers sorted by time with no duplicates at same time for same series
        // Merge duplicates at the same time slot by keeping the last
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const deduped: any[] = []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const seen = new Map<number, any>()
        for (const m of markers) {
          seen.set(m.time as number, m)
        }
        for (const m of seen.values()) deduped.push(m)
        deduped.sort((a, b) => (a.time as number) - (b.time as number))

        series.setMarkers(deduped)
      }

      chart.timeScale().fitContent()
    }

    init()

    const observer = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      chartRef.current?.remove()
    }
  }, [data, type, height, trades])

  return <div ref={containerRef} className="w-full" style={{ height }} />
}
