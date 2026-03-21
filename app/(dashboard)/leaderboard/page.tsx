'use client'

import { useUser } from '@clerk/nextjs'
import useSWR from 'swr'
import Image from 'next/image'
import { Trophy, Medal, TrendingUp, TrendingDown } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatPercent } from '@/lib/utils'
import type { LeaderboardEntry } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function LeaderboardPage() {
  const { user } = useUser()
  const { data: entries, isLoading } = useSWR<LeaderboardEntry[]>('/api/leaderboard', fetcher, {
    refreshInterval: 60000,
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Leaderboard</h1>
        <p className="text-text-muted text-sm mt-1">Ranked by total return percentage</p>
      </div>

      {/* Top 3 podium */}
      {!isLoading && entries && entries.length >= 3 && (
        <div className="grid grid-cols-3 gap-4">
          {[entries[1], entries[0], entries[2]].map((entry, i) => {
            const isFirst = entry.rank === 1
            const rankColors = ['text-text-secondary', 'text-yellow-400', 'text-orange-400']
            const actualIndex = [1, 0, 2][i]
            return (
              <div
                key={entry.userId}
                className={`card p-5 text-center ${isFirst ? 'border-yellow-400/30 bg-yellow-400/5' : ''}`}
              >
                <div className={`text-2xl font-bold mb-2 ${rankColors[actualIndex]}`}>
                  {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
                </div>
                {entry.avatarUrl ? (
                  <Image src={entry.avatarUrl} alt={entry.username} width={48} height={48} className="rounded-full mx-auto mb-2" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-surface-2 border border-border mx-auto mb-2 flex items-center justify-center">
                    <span className="text-sm font-bold text-text-secondary">{entry.username[0].toUpperCase()}</span>
                  </div>
                )}
                <p className="text-sm font-semibold text-text-primary truncate">{entry.username}</p>
                <p className={`text-lg font-bold mt-1 ${entry.returnPercent >= 0 ? 'text-green' : 'text-red'}`}>
                  {formatPercent(entry.returnPercent)}
                </p>
                <p className="text-xs text-text-muted">{formatCurrency(entry.totalValue)}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Full table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary">All Traders</h2>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !entries?.length ? (
          <div className="py-16 text-center">
            <Trophy className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-text-muted text-sm">Be the first to make a trade and claim the top spot!</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-text-muted font-medium py-3 px-5">Rank</th>
                <th className="text-left text-xs text-text-muted font-medium py-3 px-4">Trader</th>
                <th className="text-right text-xs text-text-muted font-medium py-3 px-4">Portfolio Value</th>
                <th className="text-right text-xs text-text-muted font-medium py-3 px-4">Total Return</th>
                <th className="text-right text-xs text-text-muted font-medium py-3 px-5">P&L</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => {
                const isMe = entry.username === user?.username
                return (
                  <tr
                    key={entry.userId}
                    className={`border-b border-border last:border-0 ${isMe ? 'bg-brand/5' : 'hover:bg-surface-2/50'} transition-colors`}
                  >
                    <td className="py-3 px-5">
                      <div className="flex items-center gap-2">
                        {entry.rank <= 3 ? (
                          <Medal className={`w-4 h-4 ${entry.rank === 1 ? 'text-yellow-400' : entry.rank === 2 ? 'text-text-secondary' : 'text-orange-400'}`} />
                        ) : (
                          <span className="text-text-muted font-mono w-4 text-center">{entry.rank}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        {entry.avatarUrl ? (
                          <Image src={entry.avatarUrl} alt={entry.username} width={32} height={32} className="rounded-full" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xs font-bold text-text-secondary">
                            {entry.username[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-text-primary">{entry.username}</p>
                          {isMe && <span className="text-xs text-brand">You</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-text-primary">
                      {formatCurrency(entry.totalValue)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`flex items-center justify-end gap-1 font-medium ${entry.returnPercent >= 0 ? 'text-green' : 'text-red'}`}>
                        {entry.returnPercent >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {formatPercent(entry.returnPercent)}
                      </span>
                    </td>
                    <td className={`py-3 px-5 text-right font-mono font-medium ${entry.totalPnl >= 0 ? 'text-green' : 'text-red'}`}>
                      {entry.totalPnl >= 0 ? '+' : ''}{formatCurrency(entry.totalPnl)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
