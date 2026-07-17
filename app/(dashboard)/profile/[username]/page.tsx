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
import { AVATAR_PRESETS, OWNER_AVATAR, presetUrl } from '@/lib/avatars'
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
  SHORT: 'bg-orange-500 text-white',
  COVER: 'bg-blue-500 text-white',
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
  const ownerUsername = process.env.NEXT_PUBLIC_OWNER_USERNAME ?? 'mstyli'
  const isOwner = username === ownerUsername
  const isOwnProfile = !!currentUsername && currentUsername === username

  async function selectAvatar(avatarUrl: string) {
    setSaving(true)
    await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarUrl }),
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
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand flex items-center justify-center border border-border hover:bg-brand-dim transition-colors"
                  title="Change avatar"
                >
                  <Pencil className="w-3 h-3 text-white" />
                </button>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold text-text-primary">@{profileUser?.username}</h1>
                {isOwner && (
                  <span className="text-xs bg-yellow-400 text-white px-2 py-0.5 font-medium">
                    👑 admin
                  </span>
                )}
                {isOwnProfile && !isOwner && (
                  <span className="text-xs bg-text-primary text-background px-2 py-0.5 font-medium">You</span>
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
            {/* Owner-exclusive captain's hat — only shown to the owner */}
            {isOwner && (
              <button
                onClick={() => selectAvatar(OWNER_AVATAR)}
                disabled={saving}
                title="Captain (Owner Exclusive)"
                className={cn(
                  'relative w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 border overflow-hidden',
                  profileUser?.avatarUrl === OWNER_AVATAR ? 'border-yellow-400 scale-110' : 'border-yellow-400/40 hover:border-yellow-400'
                )}
                style={{ backgroundColor: '#1a2540' }}
              >
                <svg viewBox="0 0 32 32" width="48" height="48" shapeRendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
                  <rect x="13" y="5"  width="6"  height="1" fill="#f0f0f0" />
                  <rect x="11" y="6"  width="10" height="1" fill="#f0f0f0" />
                  <rect x="9"  y="7"  width="14" height="8" fill="#f0f0f0" />
                  <rect x="9"  y="15" width="14" height="1" fill="#d8d8dc" />
                  <rect x="9"  y="16" width="14" height="1" fill="#f5c842" />
                  <rect x="9"  y="17" width="14" height="1" fill="#c9a227" />
                  <rect x="7"  y="18" width="18" height="1" fill="#2a2a2a" />
                  <rect x="5"  y="19" width="22" height="2" fill="#111111" />
                  <rect x="7"  y="21" width="18" height="1" fill="#222222" />
                  <rect x="15" y="7"  width="2"  height="1" fill="#c9a227" />
                  <rect x="16" y="7"  width="1"  height="7" fill="#c9a227" />
                  <rect x="13" y="9"  width="6"  height="1" fill="#c9a227" />
                  <rect x="12" y="9"  width="1"  height="1" fill="#c9a227" />
                  <rect x="19" y="9"  width="1"  height="1" fill="#c9a227" />
                  <rect x="13" y="13" width="2"  height="1" fill="#c9a227" />
                  <rect x="17" y="13" width="2"  height="1" fill="#c9a227" />
                  <rect x="14" y="14" width="4"  height="1" fill="#c9a227" />
                </svg>
                {profileUser?.avatarUrl === OWNER_AVATAR && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-black" />
                  </span>
                )}
              </button>
            )}
            {AVATAR_PRESETS.map((preset, i) => {
              const isSelected = profileUser?.avatarUrl === presetUrl(i)
              return (
                <button
                  key={i}
                  onClick={() => selectAvatar(presetUrl(i))}
                  disabled={saving}
                  title={preset.label}
                  className={cn(
                    'relative w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-110 border',
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
            <div className="p-4 space-y-2">
              {trades.map(trade => (
                <div key={trade.id} className="row-boxed flex items-center gap-3">
                  <span className={`text-xs font-medium px-1.5 py-0.5 flex-shrink-0 ${sideStyles[trade.side]}`}>
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
