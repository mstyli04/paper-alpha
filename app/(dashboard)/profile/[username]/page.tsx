'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowLeft, ArrowUpRight, ArrowDownRight, FileText, Pencil, Check } from 'lucide-react'
import { HoldingsTable } from '@/components/portfolio/holdings-table'
import { StatsCard } from '@/components/portfolio/stats-card'
import { PortfolioChart } from '@/components/charts/portfolio-chart'
import { AvatarDisplay } from '@/components/ui/avatar-display'
import { Skeleton } from '@/components/ui/skeleton'
import { AVATAR_PRESETS, presetUrl } from '@/lib/avatars'
import { formatCurrency, formatPercent, pnlColor, timeAgo, formatQuantity } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Portfolio, PortfolioSnapshot, TradeRecord } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface ProfileData {
  user: { username: string; avatarUrl?: string }
  portfolio: Portfolio
}

const sideStyles: Record<string, string> = {
  BUY:   'bg-green/10 text-green',
  SELL:  'bg-red/10 text-red',
  SHORT: 'bg-orange-500/10 text-orange-500',
  COVER: 'bg-blue-500/10 text-blue-500',
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { user: currentUser } = useUser()
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)

  const { data, isLoading, error, mutate } = useSWR<ProfileData>(`/api/users/${username}/portfolio`, fetcher)
  const { data: snapshots } = useSWR<PortfolioSnapshot[]>(`/api/users/${username}/snapshots`, fetcher)
  const { data: trades } = useSWR<TradeRecord[]>(`/api/users/${username}/trades`, fetcher)
  const { data: currentDbUser } = useSWR<{ username: string }>('/api/user', fetcher)

  // Clerk username may be null — fall back to DB username
  const currentUsername = currentUser?.username ?? currentDbUser?.username
  const isOwner = username === 'mstyli'
  // isOwnProfile: viewing your own profile. For the owner account, also match by email as fallback.
  const isOwnProfile = (!!currentUsername && currentUsername === username)
    || (isOwner && !!currentUser && currentUser.emailAddresses?.some(e => e.emailAddress === 'michael.stylianou7@gmail.com'))

  async function selectAvatar(index: number) {
    setSaving(true)
    await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl: presetUrl(index) }),
    })
    await mutate()
    setSaving(false)
    setShowPicker(false)
  }

  if (error || (!isLoading && !data)) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <p className="text-text-primary font-medium mb-2">User not found</p>
        <p className="text-text-muted text-sm mb-6">No trader with the username <span className="text-brand">@{username}</span> exists.</p>
        <Link href="/leaderboard" className="btn-secondary text-sm">Back to Leaderboard</Link>
      </div>
    )
  }

  const portfolio = data?.portfolio
  const profileUser = data?.user
  const startingBalance = portfolio?.startingBalance ?? 100000
  const totalTrades = trades?.length ?? 0

  return (
    <div className="space-y-6 animate-fade-in">
      <Link href="/leaderboard" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Leaderboard
      </Link>

      {/* Profile header */}
      <div className="card p-6 flex items-center gap-5">
        {isLoading ? (
          <>
            <Skeleton className="w-16 h-16 rounded-full flex-shrink-0" />
            <div className="space-y-2"><Skeleton className="h-6 w-40" /><Skeleton className="h-4 w-24" /></div>
          </>
        ) : (
          <>
            <div className="relative">
              <AvatarDisplay
                avatarUrl={profileUser?.avatarUrl}
                username={profileUser?.username}
                size={64}
                isOwner={isOwner}
              />
              {isOwnProfile && (
                <button
                  onClick={() => setShowPicker(v => !v)}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand flex items-center justify-center shadow-lg hover:bg-brand-dim transition-colors"
                  title="Change avatar"
                >
                  <Pencil className="w-3 h-3 text-white" />
                </button>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-text-primary">@{profileUser?.username}</h1>
                {isOwner && (
                  <span className="text-xs bg-yellow-400/10 text-yellow-400 border border-yellow-400/30 px-2 py-0.5 rounded-full font-semibold">
                    👑 admin
                  </span>
                )}
                {isOwnProfile && !isOwner && (
                  <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full">You</span>
                )}
              </div>
              {portfolio && (
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className={`flex items-center gap-1 text-sm font-medium ${pnlColor(portfolio.totalPnlPercent)}`}>
                    {portfolio.totalPnlPercent >= 0
                      ? <ArrowUpRight className="w-4 h-4" />
                      : <ArrowDownRight className="w-4 h-4" />
                    }
                    {formatPercent(portfolio.totalPnlPercent)} all time
                  </span>
                  <span className="text-xs text-text-muted">{totalTrades} trades</span>
                </div>
              )}
            </div>
            {isOwnProfile && (
              <Link href="/portfolio" className="text-sm text-brand hover:underline hidden sm:block">
                My Portfolio →
              </Link>
            )}
          </>
        )}
      </div>

      {/* Avatar picker */}
      {showPicker && isOwnProfile && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-text-primary">Choose your avatar</h2>
            <button onClick={() => setShowPicker(false)} className="text-xs text-text-muted hover:text-text-primary">
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-6 sm:grid-cols-12 gap-3">
            {AVATAR_PRESETS.map((preset, i) => {
              const isSelected = profileUser?.avatarUrl === presetUrl(i)
              return (
                <button
                  key={i}
                  onClick={() => selectAvatar(i)}
                  disabled={saving}
                  title={preset.label}
                  className={cn(
                    'relative w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 border-2',
                    isSelected ? 'border-brand scale-110' : 'border-transparent hover:border-border'
                  )}
                  style={{ backgroundColor: preset.bg }}
                >
                  <span className="text-2xl" role="img" aria-label={preset.label}>{preset.emoji}</span>
                  {isSelected && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand rounded-full flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-text-muted mt-3">Click an avatar to save it instantly.</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Portfolio Value" value={portfolio ? formatCurrency(portfolio.totalValue) : '$—'} loading={isLoading} />
        <StatsCard
          label="Total Return"
          value={portfolio ? formatPercent(portfolio.totalPnlPercent) : '—'}
          sub={portfolio ? formatCurrency(portfolio.totalPnl) : undefined}
          subColor={portfolio ? pnlColor(portfolio.totalPnlPercent) : undefined}
          loading={isLoading}
        />
        <StatsCard label="Unrealized P&L" value={portfolio ? formatCurrency(portfolio.unrealizedPnl) : '$—'} subColor={portfolio ? pnlColor(portfolio.unrealizedPnl) : undefined} loading={isLoading} />
        <StatsCard label="Realized P&L" value={portfolio ? formatCurrency(portfolio.realizedPnl) : '$—'} subColor={portfolio ? pnlColor(portfolio.realizedPnl) : undefined} loading={isLoading} />
      </div>

      {/* Performance chart */}
      {snapshots && snapshots.length > 1 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Performance History</h2>
          <PortfolioChart snapshots={snapshots} startingBalance={startingBalance} height={200} />
        </div>
      )}

      {/* Holdings + Recent Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Holdings</h2>
            <span className="text-xs text-text-muted">{portfolio?.holdings.length ?? 0} positions</span>
          </div>
          <HoldingsTable holdings={portfolio?.holdings ?? []} loading={isLoading} />
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-text-primary">Recent Trades</h2>
          </div>
          {!trades ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : trades.length === 0 ? (
            <div className="py-12 text-center text-text-muted text-sm">No trades yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {trades.map(trade => (
                <div key={trade.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${sideStyles[trade.side]}`}>
                    {trade.side}
                  </span>
                  <div className="flex-1 min-w-0">
                    <Link href={`/markets/${trade.symbol}?type=${trade.assetType}`} className="text-sm font-medium text-text-primary hover:text-brand transition-colors">
                      {trade.symbol}
                    </Link>
                    <p className="text-xs text-text-muted">
                      {formatQuantity(trade.quantity, trade.assetType)} @ {formatCurrency(trade.price)} · {timeAgo(trade.createdAt)}
                    </p>
                    {trade.note && (
                      <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                        <FileText className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{trade.note}</span>
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-mono text-text-primary flex-shrink-0">
                    {formatCurrency(trade.totalValue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
