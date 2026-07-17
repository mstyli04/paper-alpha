'use client'

import { useMemo, useState } from 'react'
import { bsPrice, bsGreeks, type Greeks, type OptionType } from '@/lib/options/black-scholes'
import { useChartPalette } from '@/components/charts/palette'

const GREEK_KEYS = ['delta', 'gamma', 'vega', 'theta', 'rho'] as const
type GreekKey = typeof GREEK_KEYS[number]

const GREEK_LABELS: Record<GreekKey, string> = {
  delta: 'Delta',
  gamma: 'Gamma',
  vega: 'Vega',
  theta: 'Theta',
  rho: 'Rho',
}

// Display scaling: vega per 1 vol pt, theta per day, rho per 1% rate
function displayGreek(key: GreekKey, g: Greeks): number {
  if (key === 'vega') return g.vega / 100
  if (key === 'theta') return g.theta / 365
  if (key === 'rho') return g.rho / 100
  return g[key]
}

const GREEK_UNITS: Record<GreekKey, string> = {
  delta: 'per $1 spot',
  gamma: 'Δ per $1 spot',
  vega: 'per 1 vol pt',
  theta: 'per day',
  rho: 'per 1% rate',
}

interface Point {
  x: number
  y: number
}

interface Series {
  points: Point[]
  color: string
  dashed?: boolean
  label: string
}

// Minimal theme-aware SVG line chart for function curves (x = spot, not time,
// so lightweight-charts is the wrong tool here).
function CurveChart({
  series, height = 220, markerX, chrome,
}: {
  series: Series[]
  height?: number
  markerX?: number
  chrome: { grid: string; text: string }
}) {
  const width = 640
  const pad = { top: 12, right: 14, bottom: 24, left: 52 }

  const allPoints = series.flatMap(s => s.points)
  if (allPoints.length === 0) return null
  const xMin = Math.min(...allPoints.map(p => p.x))
  const xMax = Math.max(...allPoints.map(p => p.x))
  let yMin = Math.min(...allPoints.map(p => p.y))
  let yMax = Math.max(...allPoints.map(p => p.y))
  if (yMax - yMin < 1e-12) { yMax += 1; yMin -= 1 }
  const yPadding = (yMax - yMin) * 0.08
  yMin -= yPadding
  yMax += yPadding

  const sx = (x: number) => pad.left + ((x - xMin) / (xMax - xMin)) * (width - pad.left - pad.right)
  const sy = (y: number) => pad.top + ((yMax - y) / (yMax - yMin)) * (height - pad.top - pad.bottom)

  const yTicks = [yMin + yPadding, (yMin + yMax) / 2, yMax - yPadding]
  const xTicks = [xMin, (xMin + xMax) / 2, xMax]

  const fmt = (v: number) => {
    const abs = Math.abs(v)
    if (abs >= 1000) return v.toFixed(0)
    if (abs >= 10) return v.toFixed(1)
    if (abs >= 0.1) return v.toFixed(2)
    return v.toFixed(4)
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ height: 'auto' }}
      role="img"
    >
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={pad.left} x2={width - pad.right} y1={sy(t)} y2={sy(t)} stroke={chrome.grid} strokeWidth={1} />
          <text x={pad.left - 6} y={sy(t) + 3.5} textAnchor="end" fontSize={10} fill={chrome.text}>
            {fmt(t)}
          </text>
        </g>
      ))}
      {xTicks.map((t, i) => (
        <text key={i} x={sx(t)} y={height - 8} textAnchor="middle" fontSize={10} fill={chrome.text}>
          {fmt(t)}
        </text>
      ))}
      {markerX !== undefined && markerX >= xMin && markerX <= xMax && (
        <line
          x1={sx(markerX)} x2={sx(markerX)}
          y1={pad.top} y2={height - pad.bottom}
          stroke={chrome.text} strokeWidth={1} strokeDasharray="2 3" opacity={0.6}
        />
      )}
      {series.map((s, i) => (
        <polyline
          key={i}
          points={s.points.map(p => `${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(' ')}
          fill="none"
          stroke={s.color}
          strokeWidth={i === 0 ? 2 : 1.5}
          strokeDasharray={s.dashed ? '4 4' : undefined}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

function Field({
  label, value, onChange, step, suffix,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  step?: number
  suffix?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-text-muted">{label}</span>
      <div className="relative">
        <input
          type="number"
          value={value}
          step={step ?? 1}
          onChange={e => {
            const v = parseFloat(e.target.value)
            if (Number.isFinite(v)) onChange(v)
          }}
          className="input-base w-full text-sm pr-8"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </label>
  )
}

const BRAND = { dark: '#6366f1', light: '#4f46e5' }

export function OptionsLab() {
  const [optionType, setOptionType] = useState<OptionType>('call')
  const [spot, setSpot] = useState(100)
  const [strike, setStrike] = useState(100)
  const [expiryDays, setExpiryDays] = useState(90)
  const [volPct, setVolPct] = useState(20)
  const [rdPct, setRdPct] = useState(4)
  const [rfPct, setRfPct] = useState(0)
  const [activeGreek, setActiveGreek] = useState<GreekKey>('delta')

  const { mode, chrome, signal } = useChartPalette()
  const brand = BRAND[mode]

  const t = expiryDays / 365
  const vol = volPct / 100
  const rd = rdPct / 100
  const rf = rfPct / 100

  const valid = spot > 0 && strike > 0 && expiryDays > 0 && volPct > 0

  const result = useMemo(() => {
    if (!valid) return null
    try {
      return {
        price: bsPrice(spot, strike, t, rd, rf, vol, optionType),
        greeks: bsGreeks(spot, strike, t, rd, rf, vol, optionType),
      }
    } catch {
      return null
    }
  }, [valid, spot, strike, t, rd, rf, vol, optionType])

  const curves = useMemo(() => {
    if (!valid) return null
    const lo = strike * 0.5
    const hi = strike * 1.5
    const n = 121
    const price: Point[] = []
    const intrinsic: Point[] = []
    const greek: Point[] = []
    for (let i = 0; i < n; i++) {
      const s = lo + ((hi - lo) * i) / (n - 1)
      try {
        price.push({ x: s, y: bsPrice(s, strike, t, rd, rf, vol, optionType) })
        intrinsic.push({
          x: s,
          y: optionType === 'call' ? Math.max(s - strike, 0) : Math.max(strike - s, 0),
        })
        greek.push({ x: s, y: displayGreek(activeGreek, bsGreeks(s, strike, t, rd, rf, vol, optionType)) })
      } catch {
        // skip points outside the model domain
      }
    }
    return { price, intrinsic, greek }
  }, [valid, strike, t, rd, rf, vol, optionType, activeGreek])

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Black-Scholes Pricer</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Garman-Kohlhagen model — set the carry rate to 0 for a non-dividend equity, or use it
              as the foreign rate for FX / dividend yield for equities.
            </p>
          </div>
          <div className="flex overflow-hidden border border-border rounded-lg text-xs font-medium shrink-0">
            {(['call', 'put'] as const).map(ot => (
              <button
                key={ot}
                onClick={() => setOptionType(ot)}
                className={`px-3 py-1.5 capitalize transition-colors ${
                  optionType === ot
                    ? 'bg-text-primary text-background'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {ot}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Field label="Spot" value={spot} onChange={setSpot} step={1} suffix="$" />
          <Field label="Strike" value={strike} onChange={setStrike} step={1} suffix="$" />
          <Field label="Expiry" value={expiryDays} onChange={setExpiryDays} step={1} suffix="days" />
          <Field label="Volatility" value={volPct} onChange={setVolPct} step={0.5} suffix="%" />
          <Field label="Rate" value={rdPct} onChange={setRdPct} step={0.25} suffix="%" />
          <Field label="Carry / div" value={rfPct} onChange={setRfPct} step={0.25} suffix="%" />
        </div>
      </div>

      {/* Results */}
      {!valid || !result ? (
        <div className="card p-8 text-center text-sm text-text-muted">
          Enter positive spot, strike, expiry, and volatility to price the option.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="card p-4 border-t border-t-brand">
              <p className="stat-label">Premium</p>
              <p className="stat-value text-xl mt-2">${result.price.toFixed(4)}</p>
              <p className="text-xs text-text-muted mt-1">{((result.price / spot) * 100).toFixed(2)}% of spot</p>
            </div>
            {GREEK_KEYS.map(key => {
              const v = displayGreek(key, result.greeks)
              return (
                <button
                  key={key}
                  onClick={() => setActiveGreek(key)}
                  className={`card p-4 text-left transition-colors ${
                    activeGreek === key ? 'border-brand' : 'hover:border-border-strong'
                  }`}
                >
                  <p className="stat-label">{GREEK_LABELS[key]}</p>
                  <p className={`stat-value text-xl mt-2 ${v < 0 ? 'text-red' : ''}`}>
                    {v >= 0 ? '' : '−'}{Math.abs(v) >= 100 ? Math.abs(v).toFixed(2) : Math.abs(v).toFixed(4)}
                  </p>
                  <p className="text-xs text-text-muted mt-1">{GREEK_UNITS[key]}</p>
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-primary">Value vs spot</h3>
                <div className="flex items-center gap-3 text-xs text-text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-0.5 inline-block" style={{ backgroundColor: brand }} />
                    Model
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-px border-t border-dashed inline-block" style={{ borderColor: chrome.text }} />
                    Payoff at expiry
                  </span>
                </div>
              </div>
              {curves && (
                <CurveChart
                  series={[
                    { points: curves.price, color: brand, label: 'Model' },
                    { points: curves.intrinsic, color: chrome.text, dashed: true, label: 'Payoff' },
                  ]}
                  markerX={spot}
                  chrome={chrome}
                />
              )}
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-text-primary">
                  {GREEK_LABELS[activeGreek]} vs spot
                </h3>
                <div className="flex items-center gap-1">
                  {GREEK_KEYS.map(key => (
                    <button
                      key={key}
                      onClick={() => setActiveGreek(key)}
                      className={`px-2 py-0.5 text-xs rounded-md transition-colors ${
                        activeGreek === key
                          ? 'bg-text-primary text-background font-medium'
                          : 'text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {GREEK_LABELS[key]}
                    </button>
                  ))}
                </div>
              </div>
              {curves && (
                <CurveChart
                  series={[{
                    points: curves.greek,
                    color: activeGreek === 'theta' ? signal.down : brand,
                    label: GREEK_LABELS[activeGreek],
                  }]}
                  markerX={spot}
                  chrome={chrome}
                />
              )}
              <p className="text-xs text-text-muted mt-2">
                Dashed vertical line marks the current spot. {GREEK_LABELS[activeGreek]} shown {GREEK_UNITS[activeGreek]}.
              </p>
            </div>
          </div>

          <p className="text-xs text-text-muted text-center">
            European exercise, continuous compounding. Educational tool — model values are not market prices. Not financial advice.
          </p>
        </>
      )}
    </div>
  )
}
