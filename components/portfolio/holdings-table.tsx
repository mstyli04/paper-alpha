'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency, formatPercent, formatQuantity, pnlColor } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { usePositionNotes } from '@/hooks/use-position-notes'
import type { Holding } from '@/types'

interface HoldingsTableProps {
  holdings: Holding[]
  loading?: boolean
}

interface ExpandedRowProps {
  symbol: string
  currentPrice?: number
}

function ExpandedRow({ symbol, currentPrice }: ExpandedRowProps) {
  const { getNote, saveNote } = usePositionNotes()
  const note = getNote(symbol)

  const [targetInput, setTargetInput] = useState(
    note.target !== null ? String(note.target) : ''
  )
  const [thesisInput, setThesisInput] = useState(note.thesis)
  const [saved, setSaved] = useState(false)

  const targetNum = parseFloat(targetInput) || null

  const distancePct =
    targetNum !== null && currentPrice && currentPrice > 0
      ? ((targetNum - currentPrice) / currentPrice) * 100
      : null

  function handleSave() {
    saveNote(symbol, { target: targetNum, thesis: thesisInput.trim() })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <tr className="bg-surface-2/50">
      <td colSpan={6} className="px-4 py-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          {/* Target price */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-[10px] text-text-muted font-medium uppercase tracking-wide">
              Price Target
            </label>
            <input
              type="number"
              value={targetInput}
              onChange={(e) => {
                setTargetInput(e.target.value)
                setSaved(false)
              }}
              placeholder="e.g. 500.00"
              step="0.01"
              min="0"
              className="input-base py-1.5 text-xs w-full"
            />
            {distancePct !== null && (
              <p className={`text-[10px] font-mono ${pnlColor(distancePct)}`}>
                {distancePct >= 0 ? '+' : ''}{distancePct.toFixed(2)}% to target
              </p>
            )}
          </div>

          {/* Thesis */}
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <label className="text-[10px] text-text-muted font-medium uppercase tracking-wide">
              Investment Thesis
            </label>
            <textarea
              value={thesisInput}
              onChange={(e) => {
                setThesisInput(e.target.value)
                setSaved(false)
              }}
              placeholder="Why are you holding this position?"
              rows={2}
              maxLength={500}
              className="input-base text-xs resize-none w-full py-1.5"
            />
          </div>

          {/* Save button */}
          <div className="flex flex-col justify-end mt-auto pt-4">
            <button
              type="button"
              onClick={handleSave}
              className={`btn-primary py-1.5 px-4 text-xs whitespace-nowrap ${
                saved ? 'opacity-70' : ''
              }`}
            >
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>
      </td>
    </tr>
  )
}

export function HoldingsTable({ holdings, loading }: HoldingsTableProps) {
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null)

  function toggleExpand(symbol: string) {
    setExpandedSymbol((prev) => (prev === symbol ? null : symbol))
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }

  if (!holdings.length) {
    return (
      <div className="text-center py-12 text-text-muted">
        <p className="text-sm">No holdings yet.</p>
        <p className="text-xs mt-1">Go to <Link href="/markets" className="text-brand hover:underline">Markets</Link> to start trading.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-xs text-text-muted font-medium py-3 px-4">Asset</th>
            <th className="text-right text-xs text-text-muted font-medium py-3 px-4">Quantity</th>
            <th className="text-right text-xs text-text-muted font-medium py-3 px-4">Avg Entry</th>
            <th className="text-right text-xs text-text-muted font-medium py-3 px-4">Current Price</th>
            <th className="text-right text-xs text-text-muted font-medium py-3 px-4">Value</th>
            <th className="text-right text-xs text-text-muted font-medium py-3 px-4">P&L</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map(h => {
            const isShort = h.quantity < 0
            const isExpanded = expandedSymbol === h.symbol
            return (
              <>
                <tr
                  key={h.symbol}
                  className="table-row cursor-pointer"
                  onClick={() => toggleExpand(h.symbol)}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/markets/${h.symbol}?type=${h.assetType}`}
                        className="hover:text-brand transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-text-primary">{h.symbol}</p>
                          {isShort && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 font-semibold border border-orange-500/20">
                              SHORT
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted capitalize">{h.assetType.toLowerCase()}</p>
                      </Link>
                      <span className="text-text-muted ml-auto">
                        {isExpanded
                          ? <ChevronUp className="w-3.5 h-3.5" />
                          : <ChevronDown className="w-3.5 h-3.5" />}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-text-primary">
                    {formatQuantity(Math.abs(h.quantity), h.assetType)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-text-secondary">
                    {formatCurrency(h.avgCostBasis)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-text-primary">
                    {h.currentPrice ? formatCurrency(h.currentPrice) : '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-text-primary">
                    {h.currentValue !== undefined
                      ? isShort
                        ? <span className="text-orange-400">{formatCurrency(h.currentValue)}</span>
                        : formatCurrency(h.currentValue)
                      : '—'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <p className={`font-mono font-medium ${pnlColor(h.unrealizedPnl ?? 0)}`}>
                      {h.unrealizedPnl !== undefined ? formatCurrency(h.unrealizedPnl) : '—'}
                    </p>
                    <p className={`text-xs ${pnlColor(h.unrealizedPnlPercent ?? 0)}`}>
                      {h.unrealizedPnlPercent !== undefined ? formatPercent(h.unrealizedPnlPercent) : ''}
                    </p>
                  </td>
                </tr>
                {isExpanded && (
                  <ExpandedRow
                    key={`${h.symbol}-expanded`}
                    symbol={h.symbol}
                    currentPrice={h.currentPrice}
                  />
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
