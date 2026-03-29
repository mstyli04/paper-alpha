'use client'

import { useEffect, useRef, useState } from 'react'
import type { CandleData } from '@/types'
import { rsi, macd } from '@/lib/bot/indicators'

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
  showVolume?: boolean      // default true — volume histogram in price pane
  showIndicators?: boolean  // default true — RSI/MACD panel below
}

export function PriceChart({
  data,
  type = 'area',
  height = 300,
  trades,
  showVolume = true,
  showIndicators = true,
}: PriceChartProps) {
  const containerRef          = useRef<HTMLDivElement>(null)
  const indicatorContainerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef              = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const indicatorChartRef     = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mainRangeHandlerRef      = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const indicatorRangeHandlerRef = useRef<any>(null)
  const [activeIndicator, setActiveIndicator] = useState<'RSI' | 'MACD'>('RSI')

  useEffect(() => {
    if (!containerRef.current || !data.length) return

    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let indicatorChart: any

    async function init() {
      const { createChart, ColorType, CrosshairMode } = await import('lightweight-charts')

      if (cancelled || !containerRef.current) return

      // ── Main price chart ──────────────────────────────────────────────────
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
      const upColor    = '#10b981'
      const downColor  = '#ef4444'
      const lineColor  = isPositive ? upColor : downColor

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

      // ── Volume histogram ──────────────────────────────────────────────────
      if (showVolume) {
        const volumeSeries = chart.addHistogramSeries({
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        })
        chart.priceScale('volume').applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        volumeSeries.setData(data.map((d: any) => ({
          time: d.time,
          value: d.volume ?? 0,
          color: d.close >= d.open
            ? 'rgba(16, 185, 129, 0.4)'
            : 'rgba(239, 68, 68, 0.4)',
        })))
      }

      // ── Trade markers ─────────────────────────────────────────────────────
      if (trades && trades.length > 0) {
        const candleTimes = data.map(d => d.time)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const markers: any[] = trades
          .map(trade => {
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
          .sort((a, b) => (a.time as number) - (b.time as number))

        series.setMarkers(markers)
      }

      // ── Indicator chart ───────────────────────────────────────────────────
      if (showIndicators && indicatorContainerRef.current) {
        indicatorChart = createChart(indicatorContainerRef.current, {
          width: indicatorContainerRef.current.clientWidth,
          height: 120,
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
            timeVisible: false,
            visible: false,
          },
        })
        indicatorChartRef.current = indicatorChart

        const closes = data.map(c => c.close)

        if (activeIndicator === 'RSI') {
          const rsiValues = rsi(closes, 14)
          if (rsiValues.length > 0) {
            const offset = closes.length - rsiValues.length
            const rsiSeries = indicatorChart.addLineSeries({
              color: '#818cf8',
              lineWidth: 1,
              priceScaleId: 'right',
            })
            indicatorChart.priceScale('right').applyOptions({
              autoScale: false,
              minimum: 0,
              maximum: 100,
            })
            rsiSeries.setData(
              rsiValues.map((v: number, i: number) => ({ time: data[i + offset].time, value: v }))
            )
            rsiSeries.createPriceLine({
              price: 70,
              color: 'rgba(239, 68, 68, 0.5)',
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: false,
            })
            rsiSeries.createPriceLine({
              price: 30,
              color: 'rgba(16, 185, 129, 0.5)',
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: false,
            })
          }
        } else {
          const macdValues = macd(closes)
          if (macdValues.length > 0) {
            const offset = closes.length - macdValues.length
            const histSeries = indicatorChart.addHistogramSeries({
              priceScaleId: 'right',
            })
            histSeries.setData(
              macdValues.map((v: { histogram: number; macd: number; signal: number }, i: number) => ({
                time: data[i + offset].time,
                value: v.histogram,
                color: v.histogram >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)',
              }))
            )
            const macdLine = indicatorChart.addLineSeries({
              color: '#818cf8',
              lineWidth: 1,
              priceScaleId: 'right',
            })
            macdLine.setData(
              macdValues.map((v: { histogram: number; macd: number; signal: number }, i: number) => ({
                time: data[i + offset].time,
                value: v.macd,
              }))
            )
            const signalLine = indicatorChart.addLineSeries({
              color: '#f59e0b',
              lineWidth: 1,
              priceScaleId: 'right',
            })
            signalLine.setData(
              macdValues.map((v: { histogram: number; macd: number; signal: number }, i: number) => ({
                time: data[i + offset].time,
                value: v.signal,
              }))
            )
          }
        }

        // Sync time scales bidirectionally
        const onMainRangeChange = (range: { from: number; to: number } | null) => {
          if (range) indicatorChart.timeScale().setVisibleLogicalRange(range)
        }
        const onIndicatorRangeChange = (range: { from: number; to: number } | null) => {
          if (range) chart.timeScale().setVisibleLogicalRange(range)
        }
        mainRangeHandlerRef.current      = onMainRangeChange
        indicatorRangeHandlerRef.current = onIndicatorRangeChange
        chart.timeScale().subscribeVisibleLogicalRangeChange(onMainRangeChange)
        indicatorChart.timeScale().subscribeVisibleLogicalRangeChange(onIndicatorRangeChange)
      }

      chart.timeScale().fitContent()
    }

    init()

    const observer = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
      }
      if (indicatorContainerRef.current && indicatorChartRef.current) {
        indicatorChartRef.current.applyOptions({ width: indicatorContainerRef.current.clientWidth })
      }
    })
    observer.observe(containerRef.current)

    return () => {
      cancelled = true
      observer.disconnect()
      if (chartRef.current && mainRangeHandlerRef.current) {
        chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(mainRangeHandlerRef.current)
      }
      if (indicatorChartRef.current && indicatorRangeHandlerRef.current) {
        indicatorChartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(indicatorRangeHandlerRef.current)
      }
      chartRef.current?.remove()
      chartRef.current = null
      indicatorChartRef.current?.remove()
      indicatorChartRef.current = null
    }
  }, [data, type, height, trades, showVolume, showIndicators, activeIndicator])

  return (
    <div className="w-full">
      <div ref={containerRef} className="w-full" style={{ height }} />
      {showIndicators && (
        <>
          <div className="flex items-center gap-1 px-1 py-1 border-t border-border">
            <span className="text-xs text-text-muted mr-2">Indicator</span>
            {(['RSI', 'MACD'] as const).map(ind => (
              <button
                key={ind}
                onClick={() => setActiveIndicator(ind)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  activeIndicator === ind
                    ? 'bg-brand/10 text-brand'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {ind}
              </button>
            ))}
          </div>
          <div ref={indicatorContainerRef} className="w-full" style={{ height: 120 }} />
        </>
      )}
    </div>
  )
}
