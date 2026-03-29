# Price Chart Upgrade — Design Spec
**Date:** 2026-03-29
**Project:** Paper Alpha
**Status:** Approved

---

## Problem

The price chart on `/markets/[symbol]` shows only price (area chart). There is no volume, no indicator panel, and no way to switch to candlestick view. The bot now uses RSI, MACD, and ADX as entry signals — users cannot visually verify what the bot is reacting to.

---

## Solution

Upgrade `PriceChart` to add:
1. Volume histogram in the price pane
2. Switchable RSI / MACD indicator panel below
3. Chart type toggle (Area / Candlestick) on the markets detail page

---

## Scope

**Modified files:**
- `components/charts/price-chart.tsx` — volume histogram, indicator panel, toggle state
- `app/(dashboard)/markets/[symbol]/page.tsx` — chart type toggle (Area / Candlestick)

**New files:** none

**Unchanged:** all other chart components, API routes, data model

---

## PriceChart Component Changes

### New props

```typescript
interface PriceChartProps {
  data: CandleData[]
  type?: 'line' | 'area' | 'candlestick'
  height?: number
  trades?: TradeMarker[]
  showVolume?: boolean    // default: true
  showIndicators?: boolean // default: true
}
```

### New state

```typescript
const [activeIndicator, setActiveIndicator] = useState<'RSI' | 'MACD'>('RSI')
```

### New refs

```typescript
const indicatorContainerRef = useRef<HTMLDivElement>(null)
const indicatorChartRef = useRef<any>(null)
```

---

## Volume Bars

Added to the existing main chart `useEffect` (deps: `[data, type, height, trades, showVolume]`).

A `HistogramSeries` is created with `priceScaleId: 'volume'`. The volume price scale is configured with `scaleMargins: { top: 0.8, bottom: 0 }` so it occupies only the bottom 20% of the chart.

```typescript
const volumeSeries = chart.addHistogramSeries({
  priceFormat: { type: 'volume' },
  priceScaleId: 'volume',
})
chart.priceScale('volume').applyOptions({
  scaleMargins: { top: 0.8, bottom: 0 },
})
volumeSeries.setData(
  data.map(d => ({
    time: d.time,
    value: d.volume ?? 0,
    color: d.close >= d.open
      ? 'rgba(16, 185, 129, 0.4)'   // green, 40% opacity
      : 'rgba(239, 68, 68, 0.4)',    // red, 40% opacity
  }))
)
```

If all volume values are 0 (data source doesn't provide volume), bars are invisible — no error.

---

## Indicator Panel

A second lightweight-charts instance rendered below the main chart in a separate `div` (height: 120px).

### Separate useEffect

```typescript
useEffect(() => {
  // runs when data or activeIndicator changes
  // creates indicatorChart, computes RSI or MACD, renders series
  // syncs time scale with main chart
  // cleans up on unmount or re-run
}, [data, activeIndicator, showIndicators])
```

The indicator chart uses the same colour palette as the main chart (transparent background, `#1e2334` grid lines, `#94a3b8` text).

### RSI view

```typescript
import { rsi } from '@/lib/bot/indicators'

const closes = data.map(c => c.close)
const rsiValues = rsi(closes, 14)
const offset = closes.length - rsiValues.length

// RSI line
const rsiSeries = indicatorChart.addLineSeries({
  color: '#818cf8',
  lineWidth: 1,
  priceScaleId: 'right',
})
indicatorChart.priceScale('right').applyOptions({ autoScale: false, minimum: 0, maximum: 100 })
rsiSeries.setData(
  rsiValues.map((v, i) => ({ time: data[i + offset].time, value: v }))
)

// Overbought / oversold reference lines
rsiSeries.createPriceLine({ price: 70, color: 'rgba(239, 68, 68, 0.5)', lineWidth: 1, lineStyle: 2 })
rsiSeries.createPriceLine({ price: 30, color: 'rgba(16, 185, 129, 0.5)', lineWidth: 1, lineStyle: 2 })
```

If fewer than 15 candles are available, RSI cannot be computed — the panel renders empty.

### MACD view

```typescript
import { macd } from '@/lib/bot/indicators'

const macdValues = macd(closes)
const offset = closes.length - macdValues.length

// Histogram
const histSeries = indicatorChart.addHistogramSeries({ priceScaleId: 'right' })
histSeries.setData(
  macdValues.map((v, i) => ({
    time: data[i + offset].time,
    value: v.histogram,
    color: v.histogram >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)',
  }))
)

// MACD line
const macdLine = indicatorChart.addLineSeries({ color: '#818cf8', lineWidth: 1, priceScaleId: 'right' })
macdLine.setData(macdValues.map((v, i) => ({ time: data[i + offset].time, value: v.macd })))

// Signal line
const signalLine = indicatorChart.addLineSeries({ color: '#f59e0b', lineWidth: 1, priceScaleId: 'right' })
signalLine.setData(macdValues.map((v, i) => ({ time: data[i + offset].time, value: v.signal })))
```

If fewer than 35 candles are available, MACD cannot be computed — the panel renders empty.

### Time scale synchronisation

After both charts are initialised, the visible logical range is synced bidirectionally:

```typescript
chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
  if (range) indicatorChart.timeScale().setVisibleLogicalRange(range)
})
indicatorChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
  if (range) chart.timeScale().setVisibleLogicalRange(range)
})
```

The indicator chart's time scale labels are hidden (`visible: false`) to avoid duplicating the time axis.

### Toggle buttons

Rendered between the main chart and the indicator chart:

```tsx
<div className="flex items-center gap-1 px-1 py-1 border-t border-border">
  <span className="text-xs text-text-muted mr-2">Indicator</span>
  {(['RSI', 'MACD'] as const).map(ind => (
    <button
      key={ind}
      onClick={() => setActiveIndicator(ind)}
      className={`px-2 py-0.5 text-xs rounded transition-colors ${
        activeIndicator === ind ? 'bg-brand/10 text-brand' : 'text-text-muted hover:text-text-primary'
      }`}
    >
      {ind}
    </button>
  ))}
</div>
```

---

## Chart Type Toggle (markets detail page)

New state in `app/(dashboard)/markets/[symbol]/page.tsx`:

```typescript
const [chartType, setChartType] = useState<'area' | 'candlestick'>('area')
```

Toggle rendered in the existing range selector row (right-aligned):

```tsx
<div className="flex items-center gap-1 ml-auto">
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
```

`PriceChart` call updated to pass `chartType`:

```tsx
<PriceChart data={candles} type={chartType} height={288} trades={trades} />
```

---

## Layout

```
┌─────────────────────────────────────────┐
│  [1D] [1W] [1M] [3M] [1Y]   [Area][Candles]  │  ← range + type toggles
├─────────────────────────────────────────┤
│                                         │
│         Price chart (288px)             │
│         + volume bars at bottom         │
│                                         │
├─────────────────────────────────────────┤
│  Indicator: [RSI] [MACD]                │  ← indicator toggle
├─────────────────────────────────────────┤
│         Indicator chart (120px)         │
│         (RSI line or MACD histogram)    │
└─────────────────────────────────────────┘
```

---

## ResizeObserver

The existing `ResizeObserver` in `PriceChart` already handles main chart resize. Extend it to also resize the indicator chart:

```typescript
chartRef.current?.applyOptions({ width: containerRef.current.clientWidth })
indicatorChartRef.current?.applyOptions({ width: containerRef.current.clientWidth })
```

---

## Testing

- `PriceChart` renders without errors when `data` has no volume (volume `??` 0)
- `PriceChart` renders without errors when data has fewer than 15 candles (RSI empty)
- `PriceChart` renders without errors when data has fewer than 35 candles (MACD empty)
- Toggle switches between RSI and MACD without errors
- Existing trade marker tests unaffected
