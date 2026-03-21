'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Skeleton } from '@/components/ui/skeleton'

interface CorrelationData {
  symbols: string[]
  matrix: Record<string, Record<string, number>>
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

function correlationColor(value: number): string {
  // -1 = red, 0 = neutral, +1 = green
  if (value >= 0.7) return 'bg-green text-white'
  if (value >= 0.4) return 'bg-green/50 text-green'
  if (value >= 0.1) return 'bg-green/20 text-green'
  if (value > -0.1) return 'bg-surface-2 text-text-muted'
  if (value > -0.4) return 'bg-red/20 text-red'
  if (value > -0.7) return 'bg-red/50 text-red'
  return 'bg-red text-white'
}

const SYMBOL_PRESETS = [
  { label: 'Big Tech', value: 'AAPL,MSFT,GOOGL,AMZN,META,TSLA,NVDA,AMD' },
  { label: 'Finance', value: 'JPM,BAC,GS,MS,WFC,C,BLK,V' },
  { label: 'Energy', value: 'XOM,CVX,COP,SLB,EOG,PXD,MPC,VLO' },
]

export function CorrelationHeatmap() {
  const [symbols, setSymbols] = useState(SYMBOL_PRESETS[0].value)
  const [input, setInput] = useState(SYMBOL_PRESETS[0].value)

  const { data, isLoading } = useSWR<CorrelationData>(
    `/api/market/correlation?symbols=${symbols}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  function handleApply() {
    const cleaned = input
      .toUpperCase()
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 10)
      .join(',')
    setSymbols(cleaned)
    setInput(cleaned)
  }

  return (
    <div className="card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">Return Correlation Heatmap</h3>
        <p className="text-xs text-text-muted">90-day daily return correlations. Green = move together, Red = move opposite.</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        {SYMBOL_PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => { setSymbols(p.value); setInput(p.value) }}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              symbols === p.value
                ? 'bg-brand/10 border-brand/30 text-brand'
                : 'border-border text-text-muted hover:text-text-primary'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="AAPL,MSFT,TSLA,..."
          className="input-base flex-1 text-xs"
        />
        <button onClick={handleApply} className="btn-primary text-xs px-4">
          Apply
        </button>
      </div>

      {/* Heatmap */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !data?.symbols?.length ? (
        <p className="text-sm text-text-muted text-center py-8">Failed to load correlation data</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="w-12" />
                {data.symbols.map(s => (
                  <th key={s} className="text-center text-text-muted font-medium pb-2 px-1 w-12">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.symbols.map(rowSymbol => (
                <tr key={rowSymbol}>
                  <td className="text-text-muted font-medium pr-2 py-0.5 text-right">{rowSymbol}</td>
                  {data.symbols.map(colSymbol => {
                    const val = data.matrix[rowSymbol][colSymbol]
                    return (
                      <td key={colSymbol} className="px-0.5 py-0.5">
                        <div
                          className={`w-full h-10 rounded flex items-center justify-center font-mono font-medium transition-all ${correlationColor(val)}`}
                          title={`${rowSymbol} vs ${colSymbol}: ${val}`}
                        >
                          {val.toFixed(2)}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {/* Legend */}
          <div className="flex items-center justify-center gap-3 mt-4">
            {[
              { label: '−1.0', color: 'bg-red text-white' },
              { label: '−0.5', color: 'bg-red/50 text-red' },
              { label: '0.0', color: 'bg-surface-2 text-text-muted' },
              { label: '+0.5', color: 'bg-green/50 text-green' },
              { label: '+1.0', color: 'bg-green text-white' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1">
                <div className={`w-6 h-4 rounded ${color} flex items-center justify-center text-xs font-mono`} />
                <span className="text-xs text-text-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
