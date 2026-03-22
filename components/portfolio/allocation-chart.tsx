'use client'

import { formatCurrency } from '@/lib/utils'
import type { Holding } from '@/types'

interface AllocationChartProps {
  holdings: Holding[]
}

const SEGMENT_COLORS = [
  '#6366f1', // brand/indigo
  '#22c55e', // green
  '#ef4444', // red
  '#f97316', // orange
  '#a855f7', // purple
  '#06b6d4', // cyan
  '#eab308', // yellow
  '#ec4899', // pink
  '#14b8a6', // teal
  '#3b82f6', // blue
]

interface Slice {
  symbol: string
  value: number
  pct: number
  color: string
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`
}

export function AllocationChart({ holdings }: AllocationChartProps) {
  const positiveHoldings = holdings.filter(h => (h.currentValue ?? 0) > 0)

  if (positiveHoldings.length === 0) {
    return (
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Portfolio Allocation</h2>
        <p className="text-sm text-text-muted">No holdings to display.</p>
      </div>
    )
  }

  const total = positiveHoldings.reduce((sum, h) => sum + (h.currentValue ?? 0), 0)

  const slices: Slice[] = positiveHoldings.map((h, i) => ({
    symbol: h.symbol,
    value: h.currentValue ?? 0,
    pct: total > 0 ? ((h.currentValue ?? 0) / total) * 100 : 0,
    color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
  }))

  // Build SVG pie arcs
  const cx = 80
  const cy = 80
  const r = 70
  let currentAngle = 0

  const paths = slices.map((slice) => {
    const sweep = (slice.pct / 100) * 360
    const path = arcPath(cx, cy, r, currentAngle, currentAngle + sweep)
    currentAngle += sweep
    return { ...slice, path }
  })

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-text-primary mb-4">Portfolio Allocation</h2>
      <div className="flex items-center gap-6 flex-wrap">
        {/* Pie chart */}
        <div className="flex-shrink-0">
          <svg width="160" height="160" viewBox="0 0 160 160">
            {paths.map((p) => (
              <path
                key={p.symbol}
                d={p.path}
                fill={p.color}
                stroke="var(--color-surface, #1a1a2e)"
                strokeWidth="1.5"
              />
            ))}
            {/* Inner circle for donut effect */}
            <circle cx={cx} cy={cy} r={32} fill="var(--color-surface, #1a1a2e)" />
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2 min-w-[140px]">
          {slices.map((slice) => (
            <div key={slice.symbol} className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="flex-shrink-0 w-2.5 h-2.5 rounded-sm"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="font-medium text-text-primary truncate">{slice.symbol}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 text-right">
                <span className="text-text-muted">{slice.pct.toFixed(1)}%</span>
                <span className="font-mono text-text-secondary">{formatCurrency(slice.value)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
