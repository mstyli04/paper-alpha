'use client'

import { useEffect, useRef, useState } from 'react'
import { rsi, macd } from '@/lib/bot/indicators'

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

// Net quantity held at unix time t (trades must be sorted ascending)
function getQuantityAtTime(trades: TradePoint[], t: number): number {
  let qty = 0
  for (const tr of trades) {
    if (tr.time > t) break
    if (tr.side === 'BUY' || tr.side === 'COVER') qty += tr.quantity
    else qty -= tr.quantity
  }
  return qty
}

// Weighted average cost basis at unix time t (trades must be sorted ascending)
// Returns 0 if no open position exists yet
function getAvgCostBasis(trades: TradePoint[], t: number): number {
  let totalCost = 0
  let totalQty   = 0
  for (const tr of trades) {
    if (tr.time > t) break
    if (tr.side === 'BUY' || tr.side === 'COVER') {
      totalCost += tr.quantity * tr.price
      totalQty  += tr.quantity
    } else if (tr.side === 'SELL') {
      const prev = totalQty
      totalQty  -= tr.quantity
      if (prev > 0 && totalQty > 0) totalCost = totalCost * (totalQty / prev)
      else if (totalQty <= 0) { totalCost = 0; totalQty = 0 }
    }
    // SHORT opens a separate short position — does not affect long cost basis
  }
  return totalQty > 0 ? totalCost / totalQty : 0
}

// Module-level helper — adds RSI or MACD series to an existing indicatorChart instance.
// Returns the created series so the caller can store them for later removal.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addIndicatorSeries(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  indicatorChart: any,
  symbol: string,
  data: Record<string, SymbolData>,
  activeIndicator: 'RSI' | 'MACD',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any[] {
  const symbolData = data[symbol]
  if (!symbolData) return []
  const closes = symbolData.candles.map(c => c.close)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const series: any[] = []

  if (activeIndicator === 'RSI') {
    if (closes.length < 15) return []
    const rsiValues = rsi(closes, 14)
    const offset    = closes.length - rsiValues.length
    const rsiSeries = indicatorChart.addLineSeries({
      color: '#818cf8',
      lineWidth: 1,
      priceScaleId: 'right',
      autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
    })
    rsiSeries.setData(
      rsiValues.map((v: number, i: number) => ({ time: symbolData.candles[i + offset].time, value: v }))
    )
    rsiSeries.createPriceLine({ price: 70, color: 'rgba(239,68,68,0.5)',   lineWidth: 1, lineStyle: 2 })
    rsiSeries.createPriceLine({ price: 30, color: 'rgba(16,185,129,0.5)', lineWidth: 1, lineStyle: 2 })
    series.push(rsiSeries)
  } else {
    if (closes.length < 35) return []
    const macdValues = macd(closes)
    const offset     = closes.length - macdValues.length
    const histSeries = indicatorChart.addHistogramSeries({ priceScaleId: 'right' })
    histSeries.setData(
      macdValues.map((v: { macd: number; signal: number; histogram: number }, i: number) => ({
        time:  symbolData.candles[i + offset].time,
        value: v.histogram,
        color: v.histogram >= 0 ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)',
      }))
    )
    const macdLine = indicatorChart.addLineSeries({ color: '#818cf8', lineWidth: 1, priceScaleId: 'right' })
    macdLine.setData(
      macdValues.map((v: { macd: number; signal: number; histogram: number }, i: number) => ({
        time: symbolData.candles[i + offset].time, value: v.macd,
      }))
    )
    const signalLine = indicatorChart.addLineSeries({ color: '#f59e0b', lineWidth: 1, priceScaleId: 'right' })
    signalLine.setData(
      macdValues.map((v: { macd: number; signal: number; histogram: number }, i: number) => ({
        time: symbolData.candles[i + offset].time, value: v.signal,
      }))
    )
    series.push(histSeries, macdLine, signalLine)
  }
  return series
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyPeriodRange(chart: any, p: '1W' | '1M' | '3M' | 'ALL') {
  if (p === 'ALL') { chart.timeScale().fitContent(); return }
  const days = p === '1W' ? 7 : p === '1M' ? 30 : 90
  const now  = Math.floor(Date.now() / 1000)
  chart.timeScale().setVisibleRange({ from: now - days * 86400, to: now + 86400 })
}

export function HoldingsChart({ height = 280 }: HoldingsChartProps) {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const containerRef          = useRef<HTMLDivElement>(null)
  const indicatorContainerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef              = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const indicatorChartRef     = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mainRangeHandlerRef   = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const indicatorRangeHandlerRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const indicatorSeriesRef    = useRef<any[]>([])
  const observerRef           = useRef<ResizeObserver | null>(null)
  const activeIndicatorRef    = useRef<'RSI' | 'MACD'>('RSI')
  const activeSymbolRef       = useRef<string | null>(null)

  // ── State ─────────────────────────────────────────────────────────────────
  const [data,                 setData]                = useState<Record<string, SymbolData> | null>(null)
  const [loading,              setLoading]             = useState(true)
  const [hidden,               setHidden]              = useState<Set<string>>(new Set())
  const [activeIndicatorSymbol, setActiveIndicatorSymbol] = useState<string | null>(null)
  const [activeIndicator,      setActiveIndicator]     = useState<'RSI' | 'MACD'>('RSI')
  const [period,               setPeriod]              = useState<'1W' | '1M' | '3M' | 'ALL'>('ALL')
  const periodRef                                       = useRef<'1W' | '1M' | '3M' | 'ALL'>('ALL')

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/portfolio/holdings-history')
      .then(r => r.json())
      .then(d => {
        const syms = Object.keys(d)
        setData(d)
        if (syms.length > 0) {
          setActiveIndicatorSymbol(syms[0])
          activeSymbolRef.current = syms[0]
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const symbols = data ? Object.keys(data) : []

  const colorMap: Record<string, string> = {}
  symbols.forEach((sym, i) => { colorMap[sym] = COLORS[i % COLORS.length] })

  // ── Auto-advance indicator symbol when active symbol is hidden ────────────
  useEffect(() => {
    if (!activeIndicatorSymbol) return
    if (!hidden.has(activeIndicatorSymbol)) return
    const next = symbols.find(s => !hidden.has(s)) ?? null
    setActiveIndicatorSymbol(next)
    activeSymbolRef.current = next
  }, [hidden, symbols, activeIndicatorSymbol])

  // ── Compute last % return for legend labels ───────────────────────────────
  const lastPct: Record<string, number | null> = {}
  if (data) {
    for (const [symbol, { candles, trades }] of Object.entries(data)) {
      const sorted = [...trades].sort((a, b) => a.time - b.time)
      const hasBuy = sorted.some(t => t.side === 'BUY' || t.side === 'COVER')
      if (!hasBuy) { lastPct[symbol] = null; continue }
      let last: number | null = null
      for (const c of candles) {
        const qty   = getQuantityAtTime(sorted, c.time)
        const basis = getAvgCostBasis(sorted, c.time)
        if (qty > 0 && basis > 0) last = (c.close / basis - 1) * 100
      }
      lastPct[symbol] = last
    }
  }

  // ── Effect 1: build both charts ───────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !indicatorContainerRef.current || !data || symbols.length === 0) return
    let cancelled = false

    async function init() {
      const { createChart, ColorType, LineStyle } = await import('lightweight-charts')
      if (cancelled || !containerRef.current || !indicatorContainerRef.current) return

      // Main chart
      const chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height,
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8' },
        grid:   { vertLines: { visible: false }, horzLines: { color: '#1e2334' } },
        rightPriceScale: { borderColor: '#1e2334' },
        timeScale: { borderColor: '#1e2334', timeVisible: false },
        handleScroll: true,
        handleScale: true,
        localization: { priceFormatter: (p: number) => (p >= 0 ? '+' : '') + p.toFixed(1) + '%' },
      })
      chartRef.current = chart

      let firstSeries: unknown = null

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const safeData = data as Record<string, SymbolData>
      for (const [symbol, { candles, trades }] of Object.entries(safeData)) {
        if (hidden.has(symbol)) continue
        const sorted = [...trades].sort((a, b) => a.time - b.time)
        const hasBuy = sorted.some(t => t.side === 'BUY' || t.side === 'COVER')
        if (!hasBuy) continue

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const valueData: { time: any; value: number }[] = []
        for (const c of candles) {
          const qty   = getQuantityAtTime(sorted, c.time)
          const basis = getAvgCostBasis(sorted, c.time)
          if (qty > 0 && basis > 0) valueData.push({ time: c.time, value: (c.close / basis - 1) * 100 })
        }
        if (valueData.length === 0) continue

        const series = chart.addLineSeries({
          color: colorMap[symbol],
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          title: symbol,
          priceScaleId: 'right',
        })
        series.setData(valueData)

        if (!firstSeries) {
          firstSeries = series
          series.createPriceLine({ price: 0, color: '#475569', lineWidth: 1, lineStyle: LineStyle.Dashed })
        }

        // Trade markers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const markers: any[] = []
        for (const trade of sorted) {
          const isBuy = trade.side === 'BUY' || trade.side === 'COVER'
          const snapTime = isBuy
            ? (valueData.find(p => p.time >= trade.time) ?? valueData[valueData.length - 1]).time
            : ([...valueData].reverse().find(p => p.time <= trade.time) ?? valueData[0]).time
          markers.push({
            time:     snapTime,
            position: isBuy ? 'belowBar' : 'aboveBar',
            color:    isBuy ? '#10b981'  : '#ef4444',
            shape:    isBuy ? 'arrowUp'  : 'arrowDown',
            text: `${trade.side} ${trade.quantity % 1 === 0 ? trade.quantity : trade.quantity.toFixed(4)} @ $${trade.price.toFixed(2)}`,
            size: 1,
          })
        }
        if (markers.length) {
          series.setMarkers(markers.sort((a: { time: number }, b: { time: number }) => a.time - b.time))
        }
      }

      chart.timeScale().fitContent()
      applyPeriodRange(chart, periodRef.current)

      // Indicator chart
      const indicatorChart = createChart(indicatorContainerRef.current!, {
        width: indicatorContainerRef.current!.clientWidth,
        height: 120,
        layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#94a3b8' },
        grid:   { vertLines: { visible: false }, horzLines: { color: '#1e2334' } },
        rightPriceScale: { borderColor: '#1e2334' },
        timeScale: { borderColor: '#1e2334', visible: false },
        handleScroll: false,
        handleScale: false,
      })
      indicatorChartRef.current = indicatorChart

      const sym = activeSymbolRef.current
      if (sym && !hidden.has(sym)) {
        indicatorSeriesRef.current = addIndicatorSeries(indicatorChart, sym, safeData, activeIndicatorRef.current)
      }

      // Bidirectional time-scale sync
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mainHandler      = (range: any) => { if (range) indicatorChart.timeScale().setVisibleLogicalRange(range) }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const indicatorHandler = (range: any) => { if (range) chart.timeScale().setVisibleLogicalRange(range) }
      chart.timeScale().subscribeVisibleLogicalRangeChange(mainHandler)
      indicatorChart.timeScale().subscribeVisibleLogicalRangeChange(indicatorHandler)
      mainRangeHandlerRef.current      = mainHandler
      indicatorRangeHandlerRef.current = indicatorHandler

      // ResizeObserver
      const observer = new ResizeObserver(() => {
        chartRef.current?.applyOptions({ width: containerRef.current!.clientWidth })
        indicatorChartRef.current?.applyOptions({ width: containerRef.current!.clientWidth })
      })
      observer.observe(containerRef.current!)
      observerRef.current = observer
    }

    init()

    return () => {
      cancelled = true
      observerRef.current?.disconnect()
      observerRef.current = null
      if (chartRef.current) {
        mainRangeHandlerRef.current &&
          chartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(mainRangeHandlerRef.current)
        chartRef.current.remove()
        chartRef.current = null
      }
      if (indicatorChartRef.current) {
        indicatorRangeHandlerRef.current &&
          indicatorChartRef.current.timeScale().unsubscribeVisibleLogicalRangeChange(indicatorRangeHandlerRef.current)
        indicatorChartRef.current.remove()
        indicatorChartRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, height, hidden])

  // ── Effect 2: switch indicator/symbol without rebuilding main chart ────────
  useEffect(() => {
    activeIndicatorRef.current = activeIndicator
    activeSymbolRef.current    = activeIndicatorSymbol

    const indicatorChart = indicatorChartRef.current
    if (!indicatorChart || !data || !activeIndicatorSymbol) return

    for (const s of indicatorSeriesRef.current) {
      try { indicatorChart.removeSeries(s) } catch { /* series already removed */ }
    }
    indicatorSeriesRef.current = []

    indicatorSeriesRef.current = addIndicatorSeries(indicatorChart, activeIndicatorSymbol, data!, activeIndicator)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndicator, activeIndicatorSymbol])

  // ── Effect 3: apply time-range when period changes ────────────────────────
  useEffect(() => {
    periodRef.current = period
    if (chartRef.current) applyPeriodRange(chartRef.current, period)
  }, [period])

  // ── Render ─────────────────────────────────────────────────────────────────
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

  const visibleSymbols = symbols.filter(s => !hidden.has(s))

  return (
    <div>
      {/* Period filter */}
      <div className="flex items-center gap-1 mb-3">
        {(['1W', '1M', '3M', 'ALL'] as const).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              period === p
                ? 'border-brand/40 text-brand bg-brand/10'
                : 'border-border text-text-muted hover:text-text-primary'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Legend / toggle buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {symbols.map(sym => {
          const isVisible = !hidden.has(sym)
          const pct       = lastPct[sym]
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
                isVisible ? 'border-border/60 text-text-primary' : 'border-border/30 text-text-muted opacity-50'
              }`}
            >
              <span
                className="w-3 h-0.5 rounded inline-block"
                style={{ backgroundColor: isVisible ? colorMap[sym] : '#64748b' }}
              />
              {sym}
              {isVisible && pct !== null && (
                <span className={pct >= 0 ? 'text-green' : 'text-red'}>
                  {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                </span>
              )}
            </button>
          )
        })}
        <span className="ml-auto flex items-center gap-3 text-xs text-text-muted">
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

      {/* Main chart */}
      <div ref={containerRef} className="w-full" style={{ height }} />

      {/* Indicator controls */}
      <div className="flex items-center gap-1 px-1 py-1 border-t border-border flex-wrap">
        <span className="text-xs text-text-muted mr-1">Indicator</span>
        <div className="flex gap-1 mr-3">
          {visibleSymbols.map(sym => (
            <button
              key={sym}
              type="button"
              onClick={() => { setActiveIndicatorSymbol(sym); activeSymbolRef.current = sym }}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                activeIndicatorSymbol === sym
                  ? 'bg-brand/10 text-brand'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {sym}
            </button>
          ))}
        </div>
        {(['RSI', 'MACD'] as const).map(ind => (
          <button
            key={ind}
            type="button"
            onClick={() => { setActiveIndicator(ind); activeIndicatorRef.current = ind }}
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

      {/* Indicator chart */}
      <div ref={indicatorContainerRef} className="w-full" style={{ height: 120 }} />
    </div>
  )
}
