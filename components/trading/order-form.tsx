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

export function OrderForm({ symbol, assetType, currentPrice, onSuccess }: OrderFormProps) {
  const [side, setSide] = useState<TradeSide>('BUY')
  const [quantity, setQuantity] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const { portfolio, refresh } = usePortfolio()

  const qty = parseFloat(quantity) || 0
  const total = qty * currentPrice
  const cashBalance = portfolio?.cashBalance ?? 0
  const holding = portfolio?.holdings.find(h => h.symbol === symbol)
  const heldQty = holding?.quantity ?? 0

  function setQuickAmount(fraction: number) {
    if (side === 'BUY') {
      const maxQty = cashBalance / currentPrice
      setQuantity(String(+(maxQty * fraction).toFixed(assetType === 'CRYPTO' ? 6 : 4)))
    } else {
      setQuantity(String(+(heldQty * fraction).toFixed(assetType === 'CRYPTO' ? 6 : 4)))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!qty || qty <= 0) {
      setError('Enter a valid quantity')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, assetType, side, quantity: qty }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Trade failed')
      } else {
        setSuccess(
          `${side === 'BUY' ? 'Bought' : 'Sold'} ${formatQuantity(qty, assetType)} ${symbol} @ ${formatCurrency(data.price)}`
        )
        setQuantity('')
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

  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-4">Place Order</h3>

      {/* Side toggle */}
      <div className="flex rounded-lg overflow-hidden border border-border mb-4">
        <button
          onClick={() => { setSide('BUY'); setError(''); setQuantity('') }}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            side === 'BUY' ? 'bg-green text-white' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => { setSide('SELL'); setError(''); setQuantity('') }}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            side === 'SELL' ? 'bg-red text-white' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Sell
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Current price */}
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">Market Price</span>
          <span className="text-text-primary font-mono font-medium">{formatCurrency(currentPrice)}</span>
        </div>

        {/* Quantity input */}
        <div>
          <label className="block text-xs text-text-muted mb-1.5">Quantity</label>
          <input
            type="number"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder={assetType === 'CRYPTO' ? '0.000000' : '0'}
            step={assetType === 'CRYPTO' ? '0.000001' : '0.0001'}
            min="0"
            className="input-base w-full"
          />
        </div>

        {/* Quick fractions */}
        <div className="flex gap-2">
          {[0.25, 0.5, 0.75, 1].map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setQuickAmount(f)}
              className="flex-1 py-1 text-xs font-medium text-text-muted hover:text-brand border border-border hover:border-brand rounded transition-colors"
            >
              {f === 1 ? 'Max' : `${f * 100}%`}
            </button>
          ))}
        </div>

        {/* Order total */}
        <div className="flex justify-between text-sm py-3 border-t border-border">
          <span className="text-text-muted">Order Total</span>
          <span className="font-medium text-text-primary font-mono">{formatCurrency(total)}</span>
        </div>

        {/* Available */}
        <div className="flex justify-between text-xs text-text-muted">
          {side === 'BUY' ? (
            <>
              <span>Buying Power</span>
              <span>{formatCurrency(cashBalance)}</span>
            </>
          ) : (
            <>
              <span>Available to Sell</span>
              <span>{formatQuantity(heldQty, assetType)} {symbol}</span>
            </>
          )}
        </div>

        {error && (
          <div className="text-xs text-red bg-red/10 rounded-lg px-3 py-2">{error}</div>
        )}
        {success && (
          <div className="text-xs text-green bg-green/10 rounded-lg px-3 py-2">{success}</div>
        )}

        <button
          type="submit"
          disabled={loading || !qty}
          className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            side === 'BUY' ? 'btn-green' : 'btn-red'
          }`}
        >
          {loading ? 'Processing...' : `${side === 'BUY' ? 'Buy' : 'Sell'} ${symbol}`}
        </button>
      </form>
    </div>
  )
}
