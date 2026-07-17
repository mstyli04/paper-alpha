'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, X, TrendingUp, TrendingDown } from 'lucide-react'

interface PriceAlert {
  id: string
  symbol: string
  assetType: string
  targetPrice: string
  condition: 'ABOVE' | 'BELOW'
  triggered: boolean
  triggeredAt: string | null
  seenAt: string | null
  createdAt: string
}

export function AlertsDropdown() {
  const [open, setOpen] = useState(false)
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const ref = useRef<HTMLDivElement>(null)

  async function fetchAlerts() {
    try {
      const res = await fetch('/api/alerts')
      if (res.ok) setAlerts(await res.json())
    } catch {}
  }

  async function checkAlerts() {
    try {
      await Promise.all([
        fetch('/api/alerts/check', { method: 'POST' }),
        fetch('/api/stop-orders/check', { method: 'POST' }),
      ])
      await fetchAlerts()
    } catch {}
  }

  useEffect(() => {
    fetchAlerts()
    // Check prices every 60 seconds
    const interval = setInterval(checkAlerts, 60_000)
    return () => clearInterval(interval)
  }, [])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function deleteAlert(id: string) {
    await fetch(`/api/alerts/${id}`, { method: 'DELETE' })
    setAlerts(prev => prev.filter(a => a.id !== id))
  }

  async function markSeen(id: string) {
    await fetch(`/api/alerts/${id}`, { method: 'PATCH' })
    setAlerts(prev => prev.map(a => (a.id === id ? { ...a, seenAt: new Date().toISOString() } : a)))
  }

  const unseenTriggered = alerts.filter(a => a.triggered && !a.seenAt)
  const badgeCount = unseenTriggered.length

  function handleOpen() {
    setOpen(v => !v)
    // Mark all unseen triggered alerts as seen when opening
    if (!open && unseenTriggered.length > 0) {
      unseenTriggered.forEach(a => markSeen(a.id))
    }
  }

  const active = alerts.filter(a => !a.triggered)
  const triggered = alerts.filter(a => a.triggered)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
        aria-label="Alerts"
      >
        <Bell className="w-5 h-5" />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red/10 text-red text-[10px] font-semibold rounded-full flex items-center justify-center">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold text-text-primary">Price Alerts</span>
            <span className="text-xs text-text-muted">{active.length} active</span>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="py-8 text-center text-text-muted text-sm">
                No alerts set. Go to any asset page to add one.
              </div>
            ) : (
              <>
                {triggered.length > 0 && (
                  <div>
                    <p className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase tracking-widest bg-surface-2">
                      Triggered
                    </p>
                    <div className="p-3 space-y-2">
                      {triggered.map(alert => (
                        <AlertRow key={alert.id} alert={alert} onDelete={deleteAlert} />
                      ))}
                    </div>
                  </div>
                )}
                {active.length > 0 && (
                  <div>
                    {triggered.length > 0 && (
                      <p className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase tracking-widest bg-surface-2">
                        Watching
                      </p>
                    )}
                    <div className="p-3 space-y-2">
                      {active.map(alert => (
                        <AlertRow key={alert.id} alert={alert} onDelete={deleteAlert} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AlertRow({
  alert,
  onDelete,
}: {
  alert: PriceAlert
  onDelete: (id: string) => void
}) {
  const price = parseFloat(alert.targetPrice).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 6,
  })

  return (
    <div
      className={`row-boxed flex items-center gap-3 ${
        alert.triggered ? 'border-brand' : ''
      }`}
    >
      <div className="w-7 h-7 rounded-full bg-surface-2 flex items-center justify-center flex-shrink-0">
        {alert.condition === 'ABOVE' ? (
          <TrendingUp className="w-3.5 h-3.5 text-green" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5 text-red" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">
          {alert.symbol}{' '}
          <span className={alert.condition === 'ABOVE' ? 'text-green' : 'text-red'}>
            {alert.condition === 'ABOVE' ? '↑' : '↓'}
          </span>{' '}
          {price}
        </p>
        <p className="text-xs text-text-muted">
          {alert.triggered
            ? `Triggered ${new Date(alert.triggeredAt!).toLocaleDateString()}`
            : `${alert.assetType === 'CRYPTO' ? 'Crypto' : 'Stock'} · Watching`}
        </p>
      </div>

      <button
        onClick={() => onDelete(alert.id)}
        className="p-1 text-text-muted hover:text-red transition-colors flex-shrink-0"
        aria-label="Delete alert"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
