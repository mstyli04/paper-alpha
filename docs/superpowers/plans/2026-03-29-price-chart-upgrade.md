# Price Chart Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the price chart on `/markets/[symbol]` with volume bars, a switchable RSI/MACD indicator panel, and a chart type toggle (Area / Candlestick).

**Architecture:** All changes are confined to two files. `PriceChart` gets volume bars and an indicator panel (second synchronized chart instance). The markets detail page gets a chart type toggle that controls the existing `type` prop. Indicator values are computed client-side from candle data already in memory using the existing `rsi()` and `macd()` functions from `lib/bot/indicators.ts` — no new API routes.

**Tech Stack:** TypeScript, React hooks, lightweight-charts v4.1.7, Tailwind CSS, Vitest

---

## File Map

| File | Change |
|------|--------|
| `components/charts/price-chart.tsx` | Add `showVolume`/`showIndicators` props, volume histogram, indicator panel with RSI/MACD toggle, synchronized second chart instance |
| `app/(dashboard)/markets/[symbol]/page.tsx` | Add `chartType` state and Area/Candlestick toggle |

---

### Task 1: Upgrade `PriceChart` with volume bars and indicator panel

**Files:**
- Modify: `components/charts/price-chart.tsx`

This task replaces the entire file. Read it first to confirm the current shape, then replace it.

- [ ] **Step 1: Verify existing tests pass before touching anything**

```bash
npm test 2>&1 | tail -8
```

Expected: All tests pass (baseline).

- [ ] **Step 2: Replace `components/charts/price-chart.tsx` with the upgraded version**

```typescript
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
  const [activeIndicator, setActiveIndicator] = useState<'RSI' | 'MACD'>('RSI')

  useEffect(() => {
    if (!containerRef.current || !data.length) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let indicatorChart: any

    async function init() {
      const { createChart, ColorType, CrosshairMode } = await import('lightweight-charts')

      if (!containerRef.current) return

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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const seen = new Map<number, any>()
        for (const m of markers) seen.set(m.time as number, m)
        const deduped = Array.from(seen.values())
          .sort((a, b) => (a.time as number) - (b.time as number))
        series.setMarkers(deduped)
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
        chart.timeScale().subscribeVisibleLogicalRangeChange((range: { from: number; to: number } | null) => {
          if (range) indicatorChart.timeScale().setVisibleLogicalRange(range)
        })
        indicatorChart.timeScale().subscribeVisibleLogicalRangeChange((range: { from: number; to: number } | null) => {
          if (range) chart.timeScale().setVisibleLogicalRange(range)
        })
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
      observer.disconnect()
      chartRef.current?.remove()
      indicatorChartRef.current?.remove()
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
```

- [ ] **Step 3: Run tests to confirm nothing is broken**

```bash
npm test 2>&1 | tail -8
```

Expected: All tests pass. (Chart components use canvas/DOM and are not unit-tested — existing bot tests must still pass.)

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors. If there are errors about `rsi`/`macd` return types, check `lib/bot/indicators.ts` for the exact types and adjust the inline type annotations in Step 2 accordingly.

- [ ] **Step 5: Commit**

```bash
git add components/charts/price-chart.tsx
git commit -m "feat(chart): add volume bars and RSI/MACD indicator panel to PriceChart"
```

---

### Task 2: Add chart type toggle to the markets detail page

**Files:**
- Modify: `app/(dashboard)/markets/[symbol]/page.tsx`

- [ ] **Step 1: Add `chartType` state**

Find the existing state declarations near the top of the `AssetDetailPage` component (around line 35, near `const [range, setRange] = useState<Range>('1M')`). Add directly below it:

```typescript
const [chartType, setChartType] = useState<'area' | 'candlestick'>('area')
```

- [ ] **Step 2: Add the Area / Candlestick toggle to the range selector row**

Find this block (around line 114):
```tsx
<div className="flex items-center gap-1 mb-4">
  {(['1D', '1W', '1M', '3M', '1Y'] as Range[]).map(r => (
    ...
  ))}
  {range === '1D' && (
    <span className="ml-2 text-xs ...">1-min intraday</span>
  )}
</div>
```

Replace it with:
```tsx
<div className="flex items-center gap-1 mb-4">
  {(['1D', '1W', '1M', '3M', '1Y'] as Range[]).map(r => (
    <button
      key={r}
      onClick={() => setRange(r)}
      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
        range === r ? 'bg-brand/10 text-brand' : 'text-text-muted hover:text-text-primary'
      }`}
    >
      {r}
    </button>
  ))}
  {range === '1D' && (
    <span className="ml-2 text-xs text-text-muted bg-surface-2 border border-border px-2 py-0.5 rounded-full">
      1-min intraday
    </span>
  )}
  <div className="ml-auto flex items-center gap-1">
    {(['area', 'candlestick'] as const).map(t => (
      <button
        key={t}
        onClick={() => setChartType(t)}
        className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
          chartType === t ? 'bg-brand/10 text-brand' : 'text-text-muted hover:text-text-primary'
        }`}
      >
        {t === 'area' ? 'Area' : 'Candles'}
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Pass `chartType` to `PriceChart`**

Find the `PriceChart` usage (around line 136):
```tsx
<PriceChart data={candles} type="area" height={288} trades={trades} />
```

Replace with:
```tsx
<PriceChart data={candles} type={chartType} height={288} trades={trades} />
```

- [ ] **Step 4: Run tests**

```bash
npm test 2>&1 | tail -8
```

Expected: All tests pass.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 6: Visual check in dev server**

```bash
npm run dev
```

Navigate to `/markets/AAPL?type=STOCK` (or any asset). Confirm:
- Volume bars appear at the bottom of the price chart (green/red semi-transparent)
- RSI panel appears below with purple line and dashed 70/30 reference lines
- Clicking MACD switches to histogram + MACD line (purple) + signal line (amber)
- Panning/zooming the price chart moves the indicator chart in sync
- Area / Candles toggle switches chart type correctly
- Existing trade markers (if any trades on account) still appear

- [ ] **Step 7: Commit**

```bash
git add 'app/(dashboard)/markets/[symbol]/page.tsx'
git commit -m "feat(markets): add Area/Candlestick chart type toggle"
```
