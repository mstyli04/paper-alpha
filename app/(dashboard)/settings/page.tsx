'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useTheme } from 'next-themes'
import Link from 'next/link'
import useSWR from 'swr'
import { usePortfolio } from '@/hooks/use-portfolio'
import { AvatarDisplay } from '@/components/ui/avatar-display'
import { formatCurrency } from '@/lib/utils'
import { AlertTriangle, User, Shield, Palette, BarChart2, ExternalLink, Check } from 'lucide-react'
import { OWNER_USERNAME } from '@/lib/avatars'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface DbUser { username: string; avatarUrl?: string; createdAt: string; email: string }

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const

function ThemePicker() {
  const { theme, setTheme } = useTheme()
  // `theme` is unknown until after hydration — render neutral buttons first
  // to avoid a server/client mismatch (same pattern as ThemeToggle).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted font-medium">Theme</p>
      <div className="flex gap-2">
        {THEME_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={`px-4 py-1.5 text-xs font-medium border transition-colors ${
              mounted && theme === value
                ? 'bg-text-primary text-background'
                : 'border-border text-text-muted hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-text-muted">System follows your device&apos;s appearance setting.</p>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center gap-2 border-b border-border pb-4">
        <span className="text-brand">{icon}</span>
        <h2 className="text-xs font-medium text-text-secondary">{title}</h2>
      </div>
      {children}
    </div>
  )
}

export default function SettingsPage() {
  const { user } = useUser()
  const { portfolio, refresh } = usePortfolio()
  const { data: dbUser } = useSWR<DbUser>('/api/user', fetcher)

  const [username, setUsername] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [resetting, setResetting] = useState(false)
  const [showReset, setShowReset] = useState(false)

  const isOwner = dbUser?.username === OWNER_USERNAME
  const memberSince = dbUser?.createdAt
    ? new Date(dbUser.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—'

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
      setSaveMsg(res.ok ? 'Username updated!' : (data.error || 'Failed to update'))
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
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">Settings</h1>
        <p className="text-xs text-text-muted mt-0.5">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <Section title="Profile" icon={<User className="w-4 h-4" />}>
        <div className="flex items-center gap-4">
          <AvatarDisplay
            avatarUrl={dbUser?.avatarUrl}
            username={dbUser?.username}
            size={56}
            isOwner={isOwner}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary">@{dbUser?.username ?? '—'}</p>
            <p className="text-xs text-text-muted">{dbUser?.email ?? user?.emailAddresses[0]?.emailAddress}</p>
            <p className="text-xs text-text-muted">Member since {memberSince}</p>
          </div>
          <Link
            href="/profile"
            className="flex items-center gap-1.5 text-xs text-brand hover:text-brand-dim transition-colors shrink-0"
          >
            Change avatar <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {isOwner && (
          <div className="flex items-center gap-2 px-3 py-2 border border-yellow-400">
            <span className="text-sm">👑</span>
            <div>
              <p className="text-xs font-semibold text-yellow-400">Admin Account</p>
              <p className="text-xs text-text-muted">You have owner privileges on this platform.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveUsername} className="space-y-3">
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Change Username</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={dbUser?.username ?? 'New username...'}
                minLength={3}
                className="input-base flex-1"
              />
              <button type="submit" disabled={saving || !username} className="btn-primary text-xs px-4">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
          {saveMsg && (
            <p className={`text-xs flex items-center gap-1 ${saveMsg.includes('!') ? 'text-green' : 'text-red'}`}>
              {saveMsg.includes('!') && <Check className="w-3 h-3" />}
              {saveMsg}
            </p>
          )}
        </form>
      </Section>

      {/* Paper Account */}
      <Section title="Paper Account" icon={<BarChart2 className="w-4 h-4" />}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Starting Balance', value: portfolio ? formatCurrency(portfolio.startingBalance) : '—' },
            { label: 'Current Value',    value: portfolio ? formatCurrency(portfolio.totalValue) : '—' },
            { label: 'Cash Balance',     value: portfolio ? formatCurrency(portfolio.cashBalance) : '—' },
            { label: 'Open Positions',   value: portfolio ? String(portfolio.holdings.length) : '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-text-muted mb-1">{label}</p>
              <p className="text-sm font-mono font-medium text-text-primary">{value}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-4">
          <button
            onClick={() => setShowReset(true)}
            className="flex items-center gap-2 text-sm text-red hover:opacity-80 transition-opacity"
          >
            <AlertTriangle className="w-4 h-4" />
            Reset Portfolio
          </button>
          <p className="text-xs text-text-muted mt-1">
            Clears all holdings and trades, restores your starting balance. Cannot be undone.
          </p>
        </div>

        {showReset && (
          <div className="border border-red p-4 space-y-3">
            <p className="text-sm font-medium text-text-primary">Are you sure?</p>
            <p className="text-xs text-text-muted">
              This will permanently delete all your trades and reset your balance to{' '}
              {portfolio ? formatCurrency(portfolio.startingBalance) : '$100,000'}.
            </p>
            <div className="flex gap-3">
              <button onClick={handleReset} disabled={resetting} className="btn-red text-sm">
                {resetting ? 'Resetting...' : 'Yes, reset my portfolio'}
              </button>
              <button onClick={() => setShowReset(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </div>
        )}
      </Section>

      {/* Appearance */}
      <Section title="Appearance" icon={<Palette className="w-4 h-4" />}>
        <ThemePicker />
      </Section>

      {/* Security */}
      <Section title="Security" icon={<Shield className="w-4 h-4" />}>
        <p className="text-xs text-text-muted">Authentication is managed by Clerk. Click below to manage your password, connected accounts, and two-factor authentication.</p>
        <a
          href="https://accounts.clerk.dev/user"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-brand hover:text-brand-dim transition-colors"
        >
          Manage account security <ExternalLink className="w-3 h-3" />
        </a>
      </Section>

      {/* Disclaimer */}
      <div className="card p-5 border-brand">
        <h3 className="text-xs font-medium text-brand mb-2">Disclaimer</h3>
        <p className="text-xs text-text-secondary leading-relaxed">
          Paper Alpha is a simulated trading platform for educational and entertainment purposes only.
          All trades use virtual currency with zero real monetary value. Market data may be delayed.
          Nothing on this platform constitutes financial advice. Always do your own research before investing real money.
        </p>
      </div>
    </div>
  )
}
