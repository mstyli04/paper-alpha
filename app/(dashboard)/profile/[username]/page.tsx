'use client'

import { useParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import Image from 'next/image'
import useSWR from 'swr'
import { ArrowLeft, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { HoldingsTable } from '@/components/portfolio/holdings-table'
import { StatsCard } from '@/components/portfolio/stats-card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatPercent, pnlColor } from '@/lib/utils'
import type { Portfolio } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface ProfileData {
  user: { username: string; avatarUrl?: string }
  portfolio: Portfolio
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>()
  const { user: currentUser } = useUser()
  const { data, isLoading, error } = useSWR<ProfileData>(
    `/api/users/${username}/portfolio`,
    fetcher
  )

  const isOwnProfile = currentUser?.username === username

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

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back link */}
      <Link href="/leaderboard" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Leaderboard
      </Link>

      {/* Profile header */}
      <div className="card p-6 flex items-center gap-5">
        {isLoading ? (
          <>
            <Skeleton className="w-16 h-16 rounded-full flex-shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
          </>
        ) : (
          <>
            {profileUser?.avatarUrl ? (
              <Image
                src={profileUser.avatarUrl}
                alt={profileUser.username}
                width={64}
                height={64}
                className="rounded-full border-2 border-border flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-surface-2 border-2 border-border flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-text-secondary">
                  {profileUser?.username?.[0]?.toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-text-primary">@{profileUser?.username}</h1>
                {isOwnProfile && (
                  <span className="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full">You</span>
                )}
              </div>
              {portfolio && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`flex items-center gap-1 text-sm font-medium ${pnlColor(portfolio.totalPnlPercent)}`}>
                    {portfolio.totalPnlPercent >= 0
                      ? <ArrowUpRight className="w-4 h-4" />
                      : <ArrowDownRight className="w-4 h-4" />
                    }
                    {formatPercent(portfolio.totalPnlPercent)} all time
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Portfolio Value"
          value={portfolio ? formatCurrency(portfolio.totalValue) : '$—'}
          loading={isLoading}
        />
        <StatsCard
          label="Total Return"
          value={portfolio ? formatPercent(portfolio.totalPnlPercent) : '—'}
          sub={portfolio ? formatCurrency(portfolio.totalPnl) : undefined}
          subColor={portfolio ? pnlColor(portfolio.totalPnlPercent) : undefined}
          loading={isLoading}
        />
        <StatsCard
          label="Unrealized P&L"
          value={portfolio ? formatCurrency(portfolio.unrealizedPnl) : '$—'}
          subColor={portfolio ? pnlColor(portfolio.unrealizedPnl) : undefined}
          loading={isLoading}
        />
        <StatsCard
          label="Cash Balance"
          value={portfolio ? formatCurrency(portfolio.cashBalance) : '$—'}
          loading={isLoading}
        />
      </div>

      {/* Holdings */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Holdings</h2>
          <span className="text-xs text-text-muted">{portfolio?.holdings.length ?? 0} positions</span>
        </div>
        <HoldingsTable holdings={portfolio?.holdings ?? []} loading={isLoading} />
      </div>

      {isOwnProfile && (
        <div className="text-center">
          <Link href="/portfolio" className="text-sm text-brand hover:underline">
            View your full portfolio →
          </Link>
        </div>
      )}
    </div>
  )
}
