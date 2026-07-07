'use client'

import useSWR from 'swr'
import { Trophy } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { EarnedAchievement } from '@/lib/achievements'

const fetcher = (url: string) => fetch(url).then(r => r.json())

// Brutalist solid-block badge per rarity tier (overrides lib/achievements.ts
// tint-pill styles, which stay in place for any other consumers).
const RARITY_BADGE: Record<EarnedAchievement['rarity'], string> = {
  common: 'bg-surface-2 text-text-secondary',
  rare: 'bg-blue-500 text-[#0a0a0a]',
  epic: 'bg-purple-500 text-[#0a0a0a]',
  legendary: 'bg-yellow-400 text-[#0a0a0a]',
}

const RARITY_BORDER: Record<EarnedAchievement['rarity'], string> = {
  common: 'border-border',
  rare: 'border-blue-500/40',
  epic: 'border-purple-500/40',
  legendary: 'border-yellow-400/50',
}

interface AchievementsCardProps {
  apiUrl?: string // allow custom URL for viewing other users in future
}

export function AchievementsCard({ apiUrl = '/api/portfolio/achievements' }: AchievementsCardProps) {
  const { data, isLoading } = useSWR<EarnedAchievement[]>(apiUrl, fetcher, {
    revalidateOnFocus: false,
  })

  const earned = data?.filter(a => a.earned) ?? []
  const locked = data?.filter(a => !a.earned) ?? []

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <h2 className="text-sm font-semibold text-text-primary">Achievements</h2>
        </div>
        {data && (
          <span className="text-xs text-text-muted">
            {earned.length} / {data.length} unlocked
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Earned */}
          {earned.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-2">Unlocked</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {earned.map(a => (
                  <div
                    key={a.id}
                    className={cn(
                      'border-2 p-3 flex flex-col items-center text-center gap-1',
                      RARITY_BORDER[a.rarity]
                    )}
                  >
                    <span className="text-2xl">{a.emoji}</span>
                    <p className="text-xs font-semibold text-text-primary leading-tight">{a.title}</p>
                    <span className={cn('text-[10px] px-1.5 py-0.5 font-bold uppercase tracking-wide', RARITY_BADGE[a.rarity])}>
                      {a.rarity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Locked */}
          {locked.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-2">Locked</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {locked.map(a => (
                  <div
                    key={a.id}
                    className="border-2 border-border p-3 flex flex-col items-center text-center gap-1 opacity-40"
                    title={a.description}
                  >
                    <span className="text-2xl grayscale">{a.emoji}</span>
                    <p className="text-xs font-medium text-text-muted leading-tight">{a.title}</p>
                    <p className="text-[10px] text-text-muted leading-tight">{a.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
