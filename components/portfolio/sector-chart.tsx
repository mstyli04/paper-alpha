'use client'

import type { Holding } from '@/types'

// Sector mapping for common stocks and commodities
const SECTOR_MAP: Record<string, string> = {
  // Tech
  AAPL: 'Technology', MSFT: 'Technology', GOOGL: 'Technology', GOOG: 'Technology',
  META: 'Technology', AMZN: 'Technology', NVDA: 'Technology', AMD: 'Technology',
  TSLA: 'Technology', NFLX: 'Technology', ORCL: 'Technology', CRM: 'Technology',
  ADBE: 'Technology', INTC: 'Technology', QCOM: 'Technology', AVGO: 'Technology',
  UBER: 'Technology', LYFT: 'Technology', SNAP: 'Technology', PINS: 'Technology',
  SHOP: 'Technology', SPOT: 'Technology', TWTR: 'Technology', PLTR: 'Technology',
  // Finance
  JPM: 'Finance', BAC: 'Finance', GS: 'Finance', MS: 'Finance',
  WFC: 'Finance', C: 'Finance', BLK: 'Finance', V: 'Finance',
  MA: 'Finance', AXP: 'Finance', PYPL: 'Finance', SQ: 'Finance',
  // Healthcare
  JNJ: 'Healthcare', PFE: 'Healthcare', MRNA: 'Healthcare', ABBV: 'Healthcare',
  UNH: 'Healthcare', CVS: 'Healthcare', LLY: 'Healthcare', BMY: 'Healthcare',
  // Energy
  XOM: 'Energy', CVX: 'Energy', COP: 'Energy', SLB: 'Energy',
  EOG: 'Energy', MPC: 'Energy', VLO: 'Energy',
  // Consumer
  WMT: 'Consumer', COST: 'Consumer', TGT: 'Consumer', MCD: 'Consumer',
  SBUX: 'Consumer', NKE: 'Consumer', DIS: 'Consumer', CMCSA: 'Consumer',
  // Industrials
  BA: 'Industrials', CAT: 'Industrials', GE: 'Industrials', HON: 'Industrials',
  UPS: 'Industrials', FDX: 'Industrials', RTX: 'Industrials',
  // Commodities
  'GC=F': 'Commodities', 'SI=F': 'Commodities', 'CL=F': 'Commodities',
  'BZ=F': 'Commodities', 'NG=F': 'Commodities', 'HG=F': 'Commodities',
  'PL=F': 'Commodities', 'ZW=F': 'Commodities', 'ZC=F': 'Commodities',
}

const SECTOR_COLORS: Record<string, string> = {
  Technology:  '#6366f1',
  Finance:     '#10b981',
  Healthcare:  '#06b6d4',
  Energy:      '#f59e0b',
  Consumer:    '#ec4899',
  Industrials: '#8b5cf6',
  Commodities: '#f97316',
  Crypto:      '#eab308',
  Other:       '#64748b',
}

function getSector(symbol: string, assetType: string): string {
  if (assetType === 'CRYPTO') return 'Crypto'
  return SECTOR_MAP[symbol.toUpperCase()] ?? 'Other'
}

interface SectorChartProps {
  holdings: Holding[]
}

export function SectorChart({ holdings }: SectorChartProps) {
  if (!holdings.length) return null

  // Only long positions for sector breakdown
  const longHoldings = holdings.filter(h => h.quantity > 0 && (h.currentValue ?? 0) > 0)
  if (!longHoldings.length) return null

  // Group by sector
  const sectorTotals: Record<string, number> = {}
  for (const h of longHoldings) {
    const sector = getSector(h.symbol, h.assetType)
    sectorTotals[sector] = (sectorTotals[sector] ?? 0) + (h.currentValue ?? 0)
  }

  const total = Object.values(sectorTotals).reduce((a, b) => a + b, 0)
  if (total <= 0) return null

  const sectors = Object.entries(sectorTotals)
    .map(([name, value]) => ({ name, value, pct: (value / total) * 100 }))
    .sort((a, b) => b.value - a.value)

  // Build SVG donut segments
  const r = 54
  const cx = 70
  const cy = 70
  const circumference = 2 * Math.PI * r
  let cumPct = 0

  const segments = sectors.map(s => {
    const offset = circumference * (1 - cumPct / 100)
    const dashArray = `${(s.pct / 100) * circumference} ${circumference}`
    cumPct += s.pct
    return { ...s, offset, dashArray }
  })

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-4">Sector Exposure</h3>
      <div className="flex items-center gap-6">
        {/* Donut */}
        <div className="flex-shrink-0">
          <svg width="140" height="140" viewBox="0 0 140 140">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth="18" />
            {segments.map(s => (
              <circle
                key={s.name}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={SECTOR_COLORS[s.name] ?? SECTOR_COLORS.Other}
                strokeWidth="18"
                strokeDasharray={s.dashArray}
                strokeDashoffset={s.offset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{ transition: 'stroke-dasharray 0.5s ease' }}
              />
            ))}
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2 min-w-0">
          {sectors.map(s => (
            <div key={s.name} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: SECTOR_COLORS[s.name] ?? SECTOR_COLORS.Other }}
              />
              <span className="text-xs text-text-secondary flex-1 truncate">{s.name}</span>
              <span className="text-xs font-mono text-text-primary font-medium">
                {s.pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
