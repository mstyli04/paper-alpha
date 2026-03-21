'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { usePortfolio } from '@/hooks/use-portfolio'
import { formatCurrency } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

export default function SettingsPage() {
  const { user } = useUser()
  const { portfolio, refresh } = usePortfolio()
  const [username, setUsername] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [resetting, setResetting] = useState(false)
  const [showReset, setShowReset] = useState(false)

  async function handleSaveUsername(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      const data = await res.json()
      if (res.ok) {
        setSaveMsg('Username updated!')
        setUsername('')
      } else {
        setSaveMsg(data.error || 'Failed to update')
      }
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  async function handleReset() {
    setResetting(true)
    try {
      await fetch('/api/portfolio/reset', { method: 'POST' })
      setShowReset(false)
      refresh()
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        <p className="text-text-muted text-sm mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <div className="card p-6 space-y-5">
        <h2 className="text-sm font-semibold text-text-primary border-b border-border pb-3">Profile</h2>

        <div className="space-y-1">
          <label className="text-xs text-text-muted">Email</label>
          <p className="text-sm text-text-secondary">{user?.emailAddresses[0]?.emailAddress}</p>
        </div>

        <form onSubmit={handleSaveUsername} className="space-y-3">
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Update Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="New username..."
              minLength={3}
              className="input-base w-full"
            />
          </div>
          <button type="submit" disabled={saving || !username} className="btn-primary text-sm">
            {saving ? 'Saving...' : 'Save Username'}
          </button>
          {saveMsg && (
            <p className={`text-xs ${saveMsg.includes('!') ? 'text-green' : 'text-red'}`}>{saveMsg}</p>
          )}
        </form>
      </div>

      {/* Account */}
      <div className="card p-6 space-y-5">
        <h2 className="text-sm font-semibold text-text-primary border-b border-border pb-3">Paper Account</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-text-muted mb-1">Starting Balance</p>
            <p className="text-text-primary font-mono">{portfolio ? formatCurrency(portfolio.startingBalance) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted mb-1">Current Value</p>
            <p className="text-text-primary font-mono">{portfolio ? formatCurrency(portfolio.totalValue) : '—'}</p>
          </div>
        </div>

        <div>
          <button
            onClick={() => setShowReset(true)}
            className="flex items-center gap-2 text-sm text-red hover:text-red-dim transition-colors"
          >
            <AlertTriangle className="w-4 h-4" />
            Reset Portfolio
          </button>
          <p className="text-xs text-text-muted mt-1">
            Clears all holdings, trades, and restores your starting balance. This cannot be undone.
          </p>
        </div>

        {showReset && (
          <div className="bg-red/5 border border-red/20 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-text-primary">Are you sure?</p>
            <p className="text-xs text-text-muted">
              This will permanently delete all your trades and reset your balance to{' '}
              {portfolio ? formatCurrency(portfolio.startingBalance) : '$100,000'}.
            </p>
            <div className="flex gap-3">
              <button onClick={handleReset} disabled={resetting} className="btn-red text-sm">
                {resetting ? 'Resetting...' : 'Yes, reset my portfolio'}
              </button>
              <button onClick={() => setShowReset(false)} className="btn-secondary text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="card p-5 bg-brand/5 border-brand/20">
        <h3 className="text-xs font-semibold text-brand mb-2">Disclaimer</h3>
        <p className="text-xs text-text-secondary leading-relaxed">
          Paper Alpha is a simulated trading platform for educational and entertainment purposes only.
          All trades use virtual currency with zero real monetary value. Market data may be delayed.
          Nothing on this platform constitutes financial advice. Always do your own research before
          investing real money.
        </p>
      </div>
    </div>
  )
}
