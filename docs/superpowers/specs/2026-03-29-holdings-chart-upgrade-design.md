# Holdings Chart Upgrade — Design Spec
**Date:** 2026-03-29
**Project:** Paper Alpha
**Status:** Approved

---

## Problem

The `HoldingsChart` on the portfolio tab shows absolute dollar values for each holding on a shared Y-axis. When holdings differ greatly in size (e.g. $2k AAPL vs $40k BTC), small positions are squashed flat and unreadable. There are also no technical indicators.

---

## Solution

Rewrite `HoldingsChart` to show **% return since entry** per holding (all lines start at 0%), with an RSI/MACD indicator panel below for a user-selected symbol. Same two-chart pattern used in the `PriceChart` upgrade.

---

## Scope

**Modified files:**
- `components/charts/holdings-chart.tsx` — full rewrite

**Unchanged:** `/api/portfolio/holdings-history` route, all other portfolio components

---

## Architecture

Two stacked lightweight-charts instances in one component:

1. **Main chart** (280px) — one `%` return line per holding, dashed 0% reference line, buy/sell arrow markers
2. **Indicator panel** (120px) — RSI or MACD for the user-selected symbol, time-scale synced with main chart

All computation is client-side — no API changes. The existing endpoint already returns close prices and full trade history.

---

## % Return Computation

For each symbol, at each candle time `t`:

```
avg_cost_basis(trades, t):
  running weighted average of BUY/COVER trades up to t
  on SELL: reduce qty; scale cost proportionally (FIFO-style)
  return totalCost / totalQty  (or 0 if qty == 0)

pct_return(candle, trades) = (candle.close / avg_cost_basis(trades, candle.time) − 1) × 100
```

Only emit a data point when qty > 0. When a position is fully closed, the line ends. If reopened via a new BUY, the line restarts at 0% from the new cost basis. Symbols with no BUY trades (short-only) are skipped — cost basis cannot be computed.

---

## Layout

```
┌─────────────────────────────────────────────────┐
│ [AAPL +12.4%] [NVDA -2.1%] [BTC +33.0%] ···   │  ← legend toggle buttons with live % return
│                                    ▲ Buy ▼ Sell │
├─────────────────────────────────────────────────┤
│                                                  │
│   % return chart (280px)                         │
│   − coloured line per holding                   │
│   − dashed 0% reference line                   │
│   − buy/sell arrow markers                      │
│                                                  │
├─────────────────────────────────────────────────┤
│ Indicator  [AAPL] [NVDA] [BTC]  [RSI] [MACD]   │  ← symbol + indicator toggles
├─────────────────────────────────────────────────┤
│   RSI or MACD panel (120px)                     │
└─────────────────────────────────────────────────┘
```

### Legend buttons

Each symbol button shows the current % return (last data point value):
- Positive: `text-green`
- Negative: `text-red`
- Hidden holding: muted/faded, no % shown

Clicking a button toggles that holding's visibility (same as current behaviour).

### 0% reference line

Added via `series.createPriceLine({ price: 0, lineStyle: LineStyle.Dashed, color: '#475569', lineWidth: 1 })` on the first visible series.

### No "Total" line

Removed — a blended % average across differently-sized positions is misleading.

---

## Indicator Panel

Same implementation pattern as the upgraded `PriceChart`:

- **Two-effect pattern**: Effect 1 builds main chart + initial indicator render (deps: `[data, height, hidden]`). Effect 2 switches indicator series only (deps: `[activeIndicator, activeIndicatorSymbol]`).
- **`activeIndicatorRef`**: mirrors `activeIndicator` state without being an Effect 1 dependency (prevents full chart rebuild on indicator toggle).
- **RSI**: `rsi(closes, 14)` from `@/lib/bot/indicators`. Fixed Y-axis 0–100 via `autoscaleInfoProvider`. Reference lines at 70 (red/dashed) and 30 (green/dashed). Requires ≥ 15 candles; panel renders empty otherwise.
- **MACD**: `macd(closes)` from `@/lib/bot/indicators`. Histogram + MACD line + signal line. Requires ≥ 35 candles; panel renders empty otherwise.
- **Time-scale sync**: bidirectional `subscribeVisibleLogicalRangeChange`. Indicator chart time-axis labels hidden (`visible: false`). Handlers stored in refs, unsubscribed before chart removal.
- **ResizeObserver**: created inside async `init()` after both charts ready, stored in `observerRef`, disconnected on cleanup.
- **`cancelled` flag**: set in cleanup to prevent chart creation on fast unmount.

### Symbol selector

Row of small buttons (one per visible symbol), same style as indicator toggle buttons. Defaults to first visible symbol. Selecting a symbol updates `activeIndicatorSymbol` state.

If the active symbol is hidden by the user, automatically fall back to the next visible symbol.

---

## State

```typescript
const [data, setData] = useState<Record<string, SymbolData> | null>(null)
const [loading, setLoading] = useState(true)
const [hidden, setHidden] = useState<Set<string>>(new Set())
const [activeIndicatorSymbol, setActiveIndicatorSymbol] = useState<string | null>(null)
const [activeIndicator, setActiveIndicator] = useState<'RSI' | 'MACD'>('RSI')
```

---

## Refs

```typescript
const containerRef          = useRef<HTMLDivElement>(null)
const indicatorContainerRef = useRef<HTMLDivElement>(null)
const chartRef              = useRef<any>(null)
const indicatorChartRef     = useRef<any>(null)
const mainRangeHandlerRef   = useRef<any>(null)
const indicatorRangeHandlerRef = useRef<any>(null)
const indicatorSeriesRef    = useRef<any[]>([])
const observerRef           = useRef<ResizeObserver | null>(null)
const activeIndicatorRef    = useRef<'RSI' | 'MACD'>('RSI')
const activeSymbolRef       = useRef<string | null>(null)
```

---

## Edge Cases

| Situation | Behaviour |
|-----------|-----------|
| Symbol has no BUY trades | Skip — cannot compute cost basis |
| Position fully closed, then reopened | Line ends at close, restarts at 0% on new entry |
| All holdings hidden | Indicator panel still renders for selected symbol |
| Active indicator symbol hidden | Auto-advance to next visible symbol |
| Fewer than 15 candles | RSI panel renders empty |
| Fewer than 35 candles | MACD panel renders empty |
| Single candle | Line renders as dot; indicator panels empty |

---

## Testing

No new unit tests — UI-only component. Existing 60 tests must remain green.
