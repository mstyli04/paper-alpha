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
  onTradeSuccess?: () => void
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
      <td colSpan={7} className="px-4 py-3">
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

interface SellRowProps {
  holding: Holding
  onClose: () => void
  onSuccess: () => void
}

function SellRow({ holding, onClose, onSuccess }: SellRowProps) {
  const isShort = holding.quantity < 0
  const side = isShort ? 'COVER' : 'SELL'
  const maxQty = Math.abs(holding.quantity)
  const price = holding.currentPrice ?? holding.avgCostBasis
  const maxUsd = maxQty * price

  const [inputMode, setInputMode] = useState<'qty' | 'usd'>('qty')
  const [inputValue, setInputValue] = useState(String(maxQty))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)

  const rawValue = parseFloat(inputValue) || 0
  const qty = inputMode === 'qty' ? rawValue : (price > 0 ? rawValue / price : 0)
  const total = qty * price

  function switchInputMode(mode: 'qty' | 'usd') {
    setInputMode(mode)
    setInputValue(mode === 'qty' ? String(maxQty) : String(+maxUsd.toFixed(2)))
    setError('')
  }

  async function handleConfirm() {
    setLoading(true)
    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: holding.symbol,
          assetType: holding.assetType,
          side,
          quantity: qty,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Trade failed')
        setConfirm(false)
      } else {
        onSuccess()
        onClose()
      }
    } catch {
      setError('Network error. Please try again.')
      setConfirm(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <tr className={`${isShort ? 'bg-blue-500/5' : 'bg-red/5'}`}>
      <td colSpan={7} className="px-4 py-3">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          {/* Input */}
          <div className="flex flex-col gap-1 min-w-[180px]">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-text-muted font-medium uppercase tracking-wide">
                {inputMode === 'qty' ? 'Quantity' : 'Amount (USD)'}
              </label>
              <div className="flex rounded overflow-hidden border border-border text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => switchInputMode('qty')}
                  className={`px-2 py-0.5 transition-colors ${inputMode === 'qty' ? 'bg-brand text-white' : 'text-text-muted hover:text-text-primary'}`}
                >
                  Qty
                </button>
                <button
                  type="button"
                  onClick={() => switchInputMode('usd')}
                  className={`px-2 py-0.5 transition-colors ${inputMode === 'usd' ? 'bg-brand text-white' : 'text-text-muted hover:text-text-primary'}`}
                >
                  $
                </button>
              </div>
            </div>
            <input
              type="number"
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); setError('') }}
              step={inputMode === 'qty' ? (holding.assetType === 'CRYPTO' ? '0.000001' : '0.0001') : '0.01'}
              min="0"
              className="input-base py-1.5 text-xs w-full"
            />
            {inputMode === 'usd' && qty > 0 && (
              <p className="text-[10px] text-text-muted font-mono">
                ≈ {formatQuantity(qty, holding.assetType)} {holding.symbol}
              </p>
            )}
            <button
              type="button"
              onClick={() => setInputValue(inputMode === 'qty' ? String(maxQty) : String(+maxUsd.toFixed(2)))}
              className="text-[10px] text-brand hover:underline text-left"
            >
              Max ({inputMode === 'qty' ? formatQuantity(maxQty, holding.assetType) : formatCurrency(maxUsd)})
            </button>
          </div>

          {/* Summary */}
          <div className="flex flex-col gap-1 flex-1 text-xs">
            <div className="flex justify-between text-text-muted">
              <span>Price</span>
              <span className="font-mono text-text-primary">{formatCurrency(price)}</span>
            </div>
            <div className="flex justify-between text-text-muted">
              <span>{isShort ? 'You Pay' : 'You Receive'}</span>
              <span className="font-mono text-text-primary font-semibold">{formatCurrency(total)}</span>
            </div>
            {error && <p className="text-red text-[10px]">{error}</p>}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-1.5 px-3 text-xs font-medium rounded-lg border border-border text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            {confirm ? (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading || qty <= 0 || qty > maxQty}
                className={`py-1.5 px-4 text-xs font-semibold rounded-lg text-white transition-colors disabled:opacity-50 ${isShort ? 'bg-blue-500' : 'bg-red'}`}
              >
                {loading ? 'Processing...' : 'Confirm'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setError(''); setConfirm(true) }}
                disabled={qty <= 0 || qty > maxQty}
                className={`py-1.5 px-4 text-xs font-semibold rounded-lg text-white transition-colors disabled:opacity-50 ${isShort ? 'bg-blue-500' : 'bg-red'}`}
              >
                {isShort ? 'Cover' : 'Sell'} {holding.symbol}
              </button>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}

export function HoldingsTable({ holdings, loading, onTradeSuccess }: HoldingsTableProps) {
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null)
  const [sellSymbol, setSellSymbol] = useState<string | null>(null)

  function toggleExpand(symbol: string) {
    setExpandedSymbol((prev) => (prev === symbol ? null : symbol))
    setSellSymbol(null)
  }

  function openSell(symbol: string) {
    setSellSymbol((prev) => (prev === symbol ? null : symbol))
    setExpandedSymbol(null)
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
            <th className="py-3 px-4" />
          </tr>
        </thead>
        <tbody>
          {holdings.map(h => {
            const isShort = h.quantity < 0
            const isExpanded = expandedSymbol === h.symbol
            const isSelling = sellSymbol === h.symbol
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
                  <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openSell(h.symbol)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-md border transition-colors ${
                        isSelling
                          ? isShort
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-red text-white border-red'
                          : isShort
                            ? 'text-blue-400 border-blue-400/40 hover:bg-blue-500/10'
                            : 'text-red border-red/40 hover:bg-red/10'
                      }`}
                    >
                      {isShort ? 'Cover' : 'Sell'}
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <ExpandedRow
                    key={`${h.symbol}-expanded`}
                    symbol={h.symbol}
                    currentPrice={h.currentPrice}
                  />
                )}
                {isSelling && (
                  <SellRow
                    key={`${h.symbol}-sell`}
                    holding={h}
                    onClose={() => setSellSymbol(null)}
                    onSuccess={() => { setSellSymbol(null); onTradeSuccess?.() }}
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
