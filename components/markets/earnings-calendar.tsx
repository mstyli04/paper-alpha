'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface EarningsEvent {
  symbol: string
  date: string
  epsEstimate: number | null
  revenueEstimate: number | null
  hour: string
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

function formatRevenue(val: number | null): string {
  if (val === null || val === 0) return '—'
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`
  return `$${val.toFixed(0)}`
}

function hourLabel(hour: string): string {
  if (hour === 'bmo') return 'Pre-market'
  if (hour === 'amc') return 'After-hours'
  if (hour === 'dmh') return 'During hours'
  return ''
}

function groupByDate(events: EarningsEvent[]): [string, EarningsEvent[]][] {
  const map: Record<string, EarningsEvent[]> = {}
  for (const e of events) {
    if (!map[e.date]) map[e.date] = []
    map[e.date].push(e)
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function EarningsCalendar() {
  const { data, isLoading, error } = useSWR<EarningsEvent[]>('/api/market/earnings', fetcher, {
    revalidateOnFocus: false,
  })

  const grouped = data ? groupByDate(data) : []

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Calendar className="w-4 h-4 text-brand" />
        <h2 className="text-sm font-semibold text-text-primary">Upcoming Earnings</h2>
        <span className="text-xs text-text-muted ml-auto">Next 14 days</span>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : error || !data?.length ? (
        <div className="px-5 py-10 text-center text-text-muted text-sm">
          No upcoming earnings found.
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {grouped.map(([date, events]) => (
            <div key={date} className="space-y-2">
              <span className="text-xs font-medium text-text-secondary">{formatDate(date)}</span>
              <div className="space-y-2">
                {events.map(ev => (
                  <div key={ev.symbol} className="row-boxed flex items-center gap-3">
                    <Link
                      href={`/markets/${ev.symbol}?type=STOCK`}
                      className="font-medium text-sm text-text-primary hover:text-brand transition-colors w-16 flex-shrink-0"
                    >
                      {ev.symbol}
                    </Link>
                    <div className="flex-1 flex items-center gap-3 text-xs text-text-muted flex-wrap">
                      {ev.epsEstimate !== null && (
                        <span>EPS est. <span className="text-text-secondary font-mono">${ev.epsEstimate.toFixed(2)}</span></span>
                      )}
                      {ev.revenueEstimate !== null && ev.revenueEstimate > 0 && (
                        <span>Rev est. <span className="text-text-secondary font-mono">{formatRevenue(ev.revenueEstimate)}</span></span>
                      )}
                    </div>
                    {hourLabel(ev.hour) && (
                      <span className="text-xs text-text-muted bg-surface-2 border border-border px-2 py-0.5 rounded-full flex-shrink-0">
                        {hourLabel(ev.hour)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
