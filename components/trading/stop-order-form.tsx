'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ShieldAlert, X, ChevronDown, ChevronUp } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { AssetType } from '@/types'

interface StopOrder {
  id: string
  symbol: string
  side: string
  triggerPrice: number
  condition: 'ABOVE' | 'BELOW'
  quantity: number
  status: string
  createdAt: string
}

interface StopOrderFormProps {
  symbol: string
  assetType: AssetType
  currentPrice: number
  holdingQty: number      // positive = long, negative = short
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function StopOrderForm({ symbol, assetType, currentPrice, holdingQty }: StopOrderFormProps) {
  const [open, setOpen] = useState(false)
  const [price, setPrice] = useState('')
  const [type, setType] = useState<'stop-loss' | 'take-profit'>('stop-loss')
  const [quantity, setQuantity] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { data: orders, mutate } = useSWR<StopOrder[]>('/api/stop-orders', fetcher)
  const symbolOrders = orders?.filter(o => o.symbol === symbol) ?? []

  const isLong = holdingQty > 0
  const isShort = holdingQty < 0
  const absQty = Math.abs(holdingQty)

  if (!isLong && !isShort) return null

  // For long: stop-loss = BELOW (sell), take-profit = ABOVE (sell)
  // For short: stop-loss = ABOVE (cover), take-profit = BELOW (cover)
  function getConditionAndSide() {
    if (isLong) {
      return {
        condition: type === 'stop-loss' ? 'BELOW' : 'ABOVE',
        side: 'SELL',
      }
    } else {
      return {
        condition: type === 'stop-loss' ? 'ABOVE' : 'BELOW',
        side: 'COVER',
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const triggerPrice = parseFloat(price)
    const qty = parseFloat(quantity) || absQty

    if (!triggerPrice || triggerPrice <= 0) { setError('Enter a valid price'); return }
    if (qty <= 0 || qty > absQty) { setError(`Max quantity is ${absQty}`); return }

    const { condition, side } = getConditionAndSide()

    setLoading(true)
    try {
      const res = await fetch('/api/stop-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, assetType, side, triggerPrice, condition, quantity: qty }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Failed')
      } else {
        setSuccess(`${type === 'stop-loss' ? 'Stop-loss' : 'Take-profit'} set at ${formatCurrency(triggerPrice)}`)
        setPrice('')
        setQuantity('')
        mutate()
        setTimeout(() => setSuccess(''), 4000)
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  async function cancelOrder(id: string) {
    await fetch(`/api/stop-orders/${id}`, { method: 'DELETE' })
    mutate()
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-2 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-brand" />
          <span className="text-sm font-semibold text-text-primary">Stop-Loss / Take-Profit</span>
          {symbolOrders.length > 0 && (
            <span className="badge-brand">
              {symbolOrders.length} active
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
          {/* Active orders */}
          {symbolOrders.length > 0 && (
            <div className="space-y-2">
              {symbolOrders.map(o => (
                <div key={o.id} className="row-boxed flex items-center justify-between text-xs">
                  <span className="text-text-muted">
                    {o.side === 'SELL' ? (o.condition === 'BELOW' ? 'Stop-loss' : 'Take-profit') : (o.condition === 'ABOVE' ? 'Stop-loss' : 'Take-profit')}
                    {' '}— {o.condition === 'ABOVE' ? '↑' : '↓'} <span className="font-mono tabular-nums">{formatCurrency(o.triggerPrice)}</span>
                  </span>
                  <span className="text-text-muted mx-2">·</span>
                  <span className="text-text-secondary font-medium font-mono tabular-nums">{o.quantity} shares</span>
                  <button
                    onClick={() => cancelOrder(o.id)}
                    className="ml-3 p-0.5 text-text-muted hover:text-red transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Type toggle */}
            <div className="flex gap-2 text-xs font-medium">
              <button
                type="button"
                onClick={() => setType('stop-loss')}
                className={`flex-1 py-2 border border-border transition-colors ${type === 'stop-loss' ? 'bg-red/10 text-red' : 'bg-transparent text-text-secondary hover:text-red'}`}
              >
                Stop-Loss
              </button>
              <button
                type="button"
                onClick={() => setType('take-profit')}
                className={`flex-1 py-2 border border-border transition-colors ${type === 'take-profit' ? 'bg-green/10 text-green' : 'bg-transparent text-text-secondary hover:text-green'}`}
              >
                Take-Profit
              </button>
            </div>

            <p className="text-xs text-text-muted">
              {isLong && type === 'stop-loss' && `Automatically sell if price drops below trigger. Current: ${formatCurrency(currentPrice)}`}
              {isLong && type === 'take-profit' && `Automatically sell if price rises above trigger. Current: ${formatCurrency(currentPrice)}`}
              {isShort && type === 'stop-loss' && `Automatically cover if price rises above trigger. Current: ${formatCurrency(currentPrice)}`}
              {isShort && type === 'take-profit' && `Automatically cover if price drops below trigger. Current: ${formatCurrency(currentPrice)}`}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-text-muted mb-1">Trigger Price ($)</label>
                <input
                  type="number"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                  placeholder={formatCurrency(currentPrice).replace('$', '')}
                  step="0.01"
                  min="0"
                  className="input-base w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">Quantity (max {absQty})</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder={String(absQty)}
                  step={assetType === 'CRYPTO' ? '0.000001' : '0.0001'}
                  min="0"
                  className="input-base w-full text-sm"
                />
              </div>
            </div>

            {error && <p className="text-xs text-red">{error}</p>}
            {success && <p className="text-xs text-green">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className={`w-full ${type === 'stop-loss' ? 'btn-red' : 'btn-green'}`}
            >
              {loading ? 'Setting...' : `Set ${type === 'stop-loss' ? 'Stop-Loss' : 'Take-Profit'}`}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
