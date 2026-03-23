'use client'

import { useEffect, useRef, useState } from 'react'

type TradeSide = 'BUY' | 'SELL' | 'SHORT' | 'COVER'

interface TradePoint {
  time: number
  side: TradeSide
  quantity: number
  price: number
}

interface CandlePoint {
  time: number
  close: number
}

interface SymbolData {
  assetType: string
  candles: CandlePoint[]
  trades: TradePoint[]
}

interface HoldingsChartProps {
  height?: number
}

const COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4',
  '#a855f7', '#84cc16',
]

// Compute net quantity held at a given unix timestamp based on trade history
function getQuantityAtTime(trades: TradePoint[], time: number): number {
  let qty = 0
  for (const t of trades) {
    if (t.time > time) break
    if (t.side === 'BUY' || t.side === 'COVER') qty += t.quantity
    else qty -= t.quantity // SELL or SHORT
  }
  return qty
}

// Find the nearest time value in a series to snap a marker to
function nearestSeriesTime(
  tradeTime: number,
  valueData: { time: number; value: number }[],
  prefer: 'after' | 'before'
): number | null {
  if (!valueData.length) return null
  if (prefer === 'after') {
    const found = valueData.find(p => p.time >= tradeTime)
    return found?.time ?? valueData[valueData.length - 1].time
  } else {
    const found = [...valueData].reverse().find(p => p.time <= tradeTime)
    return found?.time ?? valueData[0].time
  }
}

export function HoldingsChart({ height = 320 }: HoldingsChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<Record<string, SymbolData> | null>(null)
  const [loading, setLoading] = useState(true)
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/portfolio/holdings-history')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const symbols = data ? Object.keys(data) : []
  const colorMap: Record<string, string> = {}
  symbols.forEach((sym, i) => { colorMap[sym] = COLORS[i % COLORS.length] })

  useEffect(() => {
    if (!containerRef.current || !data || symbols.length === 0) return

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
        timeScale: { borderColor: '#1e2334', timeVisible: false },
        handleScroll: true,
        handleScale: true,
        localization: {
          priceFormatter: (p: number) =>
            '$' + p.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
        },
      })

      // Track all timestamps across visible symbols for the total line
      const allTimes = new Set<number>()
      const symbolValueMap: Record<string, { time: number; value: number }[]> = {}

      for (const [symbol, { candles, trades }] of Object.entries(data!)) {
        if (hidden.has(symbol)) continue

        const sortedTrades = [...trades].sort((a, b) => a.time - b.time)

        // Build value series: value of this holding at each candle point
        const valueData: { time: number; value: number }[] = []
        for (const c of candles) {
          const qty = getQuantityAtTime(sortedTrades, c.time)
          if (qty !== 0) {
            valueData.push({ time: c.time, value: Math.abs(qty) * c.close })
            allTimes.add(c.time)
          }
        }

        symbolValueMap[symbol] = valueData
        if (valueData.length === 0) continue

        const series = chart.addLineSeries({
          color: colorMap[symbol],
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: symbol,
        })
        series.setData(valueData)

        // Add buy/sell markers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const markers: any[] = []
        for (const trade of sortedTrades) {
          const isBuy = trade.side === 'BUY' || trade.side === 'COVER'
          const snapTime = nearestSeriesTime(trade.time, valueData, isBuy ? 'after' : 'before')
          if (snapTime === null) continue

          markers.push({
            time: snapTime,
            position: isBuy ? 'belowBar' : 'aboveBar',
            color: isBuy ? '#10b981' : '#ef4444',
            shape: isBuy ? 'arrowUp' : 'arrowDown',
            text: `${trade.side} ${trade.quantity % 1 === 0 ? trade.quantity : trade.quantity.toFixed(4)} @ $${trade.price.toFixed(2)}`,
            size: 1,
          })
        }
        if (markers.length) {
          series.setMarkers(markers.sort((a: { time: number }, b: { time: number }) => a.time - b.time))
        }
      }

      // --- Total holdings line ---
      const sortedTimes = [...allTimes].sort((a, b) => a - b)
      if (sortedTimes.length > 1) {
        const totalData: { time: number; value: number }[] = []

        for (const t of sortedTimes) {
          let total = 0
          for (const [symbol, valuePoints] of Object.entries(symbolValueMap)) {
            if (hidden.has(symbol)) continue
            const exact = valuePoints.find(p => p.time === t)
            if (exact) {
              total += exact.value
            } else {
              // Use last known value before this timestamp
              const prev = [...valuePoints].reverse().find(p => p.time < t)
              if (prev) total += prev.value
            }
          }
          if (total > 0) totalData.push({ time: t, value: total })
        }

        if (totalData.length > 1) {
          const totalSeries = chart.addLineSeries({
            color: '#e2e8f0',
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            priceLineVisible: false,
            lastValueVisible: true,
            title: 'Total',
          })
          totalSeries.setData(totalData)
        }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, height, hidden])

  if (loading) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-text-muted text-sm">
        Loading holdings history…
      </div>
    )
  }

  if (!data || symbols.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-text-muted text-sm">
        Make your first trade to see holdings performance
      </div>
    )
  }

  return (
    <div>
      {/* Legend / toggle buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {symbols.map(sym => {
          const isVisible = !hidden.has(sym)
          return (
            <button
              key={sym}
              type="button"
              onClick={() =>
                setHidden(prev => {
                  const next = new Set(prev)
                  if (next.has(sym)) next.delete(sym)
                  else next.add(sym)
                  return next
                })
              }
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                isVisible
                  ? 'border-border/60 text-text-primary'
                  : 'border-border/30 text-text-muted opacity-50'
              }`}
            >
              <span
                className="w-3 h-0.5 rounded inline-block"
                style={{ backgroundColor: isVisible ? colorMap[sym] : '#64748b' }}
              />
              {sym}
            </button>
          )
        })}
        <span className="flex items-center gap-1.5 text-xs text-text-muted ml-1">
          <span className="inline-block w-4 border-t-2 border-dashed border-slate-300" />
          Total
        </span>
        <span className="flex items-center gap-3 text-xs text-text-muted ml-auto">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-green" />
            Buy
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-red" />
            Sell
          </span>
        </span>
      </div>
      <div ref={containerRef} className="w-full" style={{ height }} />
    </div>
  )
}
