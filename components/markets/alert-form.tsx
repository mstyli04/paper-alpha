'use client'

import { useState } from 'react'
import { Bell, X } from 'lucide-react'
import type { AssetType } from '@/types'

interface AlertFormProps {
  symbol: string
  assetType: AssetType
  currentPrice: number
}

export function AlertForm({ symbol, assetType, currentPrice }: AlertFormProps) {
  const [condition, setCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE')
  const [targetPrice, setTargetPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const price = parseFloat(targetPrice)
    if (isNaN(price) || price <= 0) {
      setError('Enter a valid price')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, assetType, targetPrice: price, condition }),
      })
      if (!res.ok) throw new Error('Failed to create alert')
      setSuccess(true)
      setTargetPrice('')
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Failed to create alert')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-brand" />
        <h3 className="text-sm font-semibold text-text-primary">Price Alert</h3>
      </div>

      <p className="text-xs text-text-muted">
        Current price: <span className="text-text-primary font-mono">${currentPrice.toLocaleString()}</span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Condition toggle */}
        <div className="flex rounded-lg overflow-hidden border border-border text-xs font-medium">
          {(['ABOVE', 'BELOW'] as const).map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setCondition(c)}
              className={`flex-1 py-2 transition-colors ${
                condition === c
                  ? 'bg-brand text-white'
                  : 'text-text-muted hover:text-text-primary bg-surface-2'
              }`}
            >
              {c === 'ABOVE' ? 'Goes above' : 'Goes below'}
            </button>
          ))}
        </div>

        {/* Target price input */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
          <input
            type="number"
            step="any"
            min="0"
            placeholder="Target price"
            value={targetPrice}
            onChange={e => setTargetPrice(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-lg pl-7 pr-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-brand"
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {success && <p className="text-xs text-green-400">Alert created!</p>}

        <button
          type="submit"
          disabled={loading || !targetPrice}
          className="w-full bg-brand hover:bg-brand/90 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
        >
          {loading ? 'Creating...' : 'Set Alert'}
        </button>
      </form>
    </div>
  )
}
