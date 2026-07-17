'use client'

import { useState } from 'react'
import { usePortfolio } from '@/hooks/use-portfolio'
import { formatCurrency, formatQuantity } from '@/lib/utils'
import type { AssetType, TradeSide } from '@/types'

interface OrderFormProps {
  symbol: string
  assetType: AssetType
  currentPrice: number
  onSuccess?: () => void
}

type Tab = 'BUY' | 'SELL' | 'SHORT' | 'COVER'
type InputMode = 'qty' | 'usd'

export function OrderForm({ symbol, assetType, currentPrice, onSuccess }: OrderFormProps) {
  const [tab, setTab] = useState<Tab>('BUY')
  const [inputMode, setInputMode] = useState<InputMode>('qty')
  const [inputValue, setInputValue] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const { portfolio, refresh } = usePortfolio()

  const cashBalance = portfolio?.cashBalance ?? 0
  const holding = portfolio?.holdings.find(h => h.symbol === symbol)
  const heldQty = holding?.quantity ?? 0
  const isShort = heldQty < 0
  const shortQty = Math.abs(Math.min(heldQty, 0))
  const longQty = Math.max(heldQty, 0)

  // Derive qty and total from inputValue + inputMode
  const rawValue = parseFloat(inputValue) || 0
  const qty = inputMode === 'qty' ? rawValue : (currentPrice > 0 ? rawValue / currentPrice : 0)
  const total = qty * currentPrice

  function setQuickAmount(fraction: number) {
    let maxQty = 0
    if (tab === 'BUY') maxQty = cashBalance / currentPrice
    else if (tab === 'SELL') maxQty = longQty
    else if (tab === 'SHORT') maxQty = cashBalance / currentPrice
    else if (tab === 'COVER') maxQty = shortQty

    if (inputMode === 'qty') {
      setInputValue(String(+(maxQty * fraction).toFixed(assetType === 'CRYPTO' ? 6 : 4)))
    } else {
      const maxUsd = maxQty * currentPrice
      setInputValue(String(+(maxUsd * fraction).toFixed(2)))
    }
  }

  function switchTab(t: Tab) {
    setTab(t)
    setError('')
    setInputValue('')
    setNote('')
    setSuccess('')
    setShowConfirm(false)
  }

  function switchInputMode(mode: InputMode) {
    setInputMode(mode)
    setInputValue('')
    setError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!qty || qty <= 0) {
      setError('Enter a valid amount')
      return
    }
    setShowConfirm(true)
  }

  async function handleConfirm() {
    setLoading(true)
    setShowConfirm(false)
    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, assetType, side: tab, quantity: qty, note: note.trim() || undefined }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Trade failed')
      } else {
        const labels: Record<Tab, string> = {
          BUY: 'Bought',
          SELL: 'Sold',
          SHORT: 'Shorted',
          COVER: 'Covered',
        }
        setSuccess(
          `${labels[tab]} ${formatQuantity(qty, assetType)} ${symbol} @ ${formatCurrency(data.price)}`
        )
        setInputValue('')
        setNote('')
        refresh()
        onSuccess?.()
        setTimeout(() => setSuccess(''), 5000)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    setShowConfirm(false)
  }

  const tabs: { id: Tab; label: string; color: string; activeColor: string }[] = [
    { id: 'BUY', label: 'Buy', color: 'hover:text-green', activeColor: 'bg-green/10 text-green' },
    { id: 'SELL', label: 'Sell', color: 'hover:text-red', activeColor: 'bg-red/10 text-red' },
    { id: 'SHORT', label: 'Short', color: 'hover:text-orange-400', activeColor: 'bg-orange-500/10 text-orange-500' },
    { id: 'COVER', label: 'Cover', color: 'hover:text-blue-400', activeColor: 'bg-blue-500/10 text-blue-500' },
  ]

  const activeTab = tabs.find(t => t.id === tab)!

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-4">Place Order</h3>

      {/* Tab bar */}
      <div className="flex gap-2 mb-4 text-sm font-medium">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            className={`flex-1 py-2 border border-border rounded-lg transition-colors ${
              tab === t.id ? t.activeColor : `bg-transparent text-text-secondary ${t.color}`
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Short/Cover info banners */}
      {tab === 'SHORT' && (
        <div className="text-xs text-orange-400 border border-border bg-transparent px-3 py-2 mb-4">
          Short selling: you profit if the price falls. You receive cash now and must buy back later.
        </div>
      )}
      {tab === 'COVER' && shortQty === 0 && (
        <div className="card-inset text-xs text-text-muted px-3 py-2 mb-4">
          You don&apos;t have an open short position in {symbol}.
        </div>
      )}
      {tab === 'COVER' && shortQty > 0 && (
        <div className="text-xs text-blue-400 border border-border bg-transparent px-3 py-2 mb-4">
          Short position: {formatQuantity(shortQty, assetType)} {symbol} @ avg {formatCurrency(holding?.avgCostBasis ?? 0)}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">Market Price</span>
          <span className="text-text-primary font-mono font-medium tabular-nums">{formatCurrency(currentPrice)}</span>
        </div>

        <div>
          {/* Label row with Qty/$ toggle */}
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs text-text-muted">
              {inputMode === 'qty' ? 'Quantity' : 'Amount (USD)'}
            </label>
            <div className="flex overflow-hidden border border-border rounded-md text-[10px] font-semibold">
              <button
                type="button"
                onClick={() => switchInputMode('qty')}
                className={`px-2 py-0.5 transition-colors ${inputMode === 'qty' ? 'bg-text-primary text-background' : 'text-text-muted hover:text-text-primary'}`}
              >
                Qty
              </button>
              <button
                type="button"
                onClick={() => switchInputMode('usd')}
                className={`px-2 py-0.5 transition-colors ${inputMode === 'usd' ? 'bg-text-primary text-background' : 'text-text-muted hover:text-text-primary'}`}
              >
                $
              </button>
            </div>
          </div>
          <input
            type="number"
            value={inputValue}
            onChange={e => { setInputValue(e.target.value); setError('') }}
            placeholder={inputMode === 'qty' ? (assetType === 'CRYPTO' ? '0.000000' : '0') : '0.00'}
            step={inputMode === 'qty' ? (assetType === 'CRYPTO' ? '0.000001' : '0.0001') : '0.01'}
            min="0"
            className="input-base w-full"
          />
          {/* Show computed qty when in USD mode */}
          {inputMode === 'usd' && qty > 0 && (
            <p className="text-[10px] text-text-muted mt-1 font-mono tabular-nums">
              ≈ {formatQuantity(qty, assetType)} {symbol}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          {[0.25, 0.5, 0.75, 1].map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setQuickAmount(f)}
              className="flex-1 py-1 text-xs font-medium text-text-muted hover:text-brand border border-border hover:border-brand transition-colors"
            >
              {f === 1 ? 'Max' : `${f * 100}%`}
            </button>
          ))}
        </div>

        <div className="flex justify-between text-sm py-3 border-t border-border">
          <span className="text-text-muted">{tab === 'SHORT' ? 'You Receive' : tab === 'COVER' ? 'You Pay' : 'Order Total'}</span>
          <span className="font-medium text-text-primary font-mono tabular-nums">{formatCurrency(total)}</span>
        </div>

        <div className="flex justify-between text-xs text-text-muted">
          {tab === 'BUY' || tab === 'COVER' ? (
            <><span>Buying Power</span><span className="font-mono tabular-nums">{formatCurrency(cashBalance)}</span></>
          ) : tab === 'SELL' ? (
            <><span>Available to Sell</span><span className="font-mono tabular-nums">{formatQuantity(longQty, assetType)} {symbol}</span></>
          ) : (
            <><span>Short with</span><span className="font-mono tabular-nums">{formatCurrency(cashBalance)}</span></>
          )}
        </div>

        <div>
          <label className="block text-xs text-text-muted mb-1.5">Trade Note (optional)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Why are you making this trade?"
            rows={2}
            maxLength={500}
            className="input-base w-full resize-none text-xs"
          />
        </div>

        {error && <p className="text-xs text-red">{error}</p>}
        {success && <p className="text-xs text-green">{success}</p>}

        {showConfirm ? (
          <div className="card-inset p-4 space-y-3">
            <p className="text-xs font-medium text-text-secondary">Confirm Order</p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-text-muted">Side</span>
                <span className={`font-semibold ${
                  tab === 'BUY' ? 'text-green' :
                  tab === 'SELL' ? 'text-red' :
                  tab === 'SHORT' ? 'text-orange-400' :
                  'text-blue-400'
                }`}>{tab}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Symbol</span>
                <span className="text-text-primary font-medium">{symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Quantity</span>
                <span className="text-text-primary font-mono tabular-nums">{formatQuantity(qty, assetType)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Est. Price</span>
                <span className="text-text-primary font-mono tabular-nums">{formatCurrency(currentPrice)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1.5 mt-1.5">
                <span className="text-text-muted font-medium">Total Value</span>
                <span className="text-text-primary font-mono tabular-nums font-semibold">{formatCurrency(total)}</span>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 py-2 text-xs font-medium border border-border text-text-muted hover:text-text-primary hover:border-border-strong transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className={`flex-1 py-2 text-xs font-medium border border-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${activeTab.activeColor}`}
              >
                {loading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="submit"
            disabled={loading || !qty}
            className={`w-full py-2.5 text-sm font-medium border border-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${activeTab.activeColor}`}
          >
            {loading ? 'Processing...' : `${activeTab.label} ${symbol}`}
          </button>
        )}
      </form>
    </div>
  )
}
