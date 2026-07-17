'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useState, Suspense } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { timeAgo } from '@/lib/utils'
import { MarketOverview } from '@/components/markets/market-overview'
import { TrendingAssets } from '@/components/markets/trending-assets'
import { Screener } from '@/components/markets/screener'
import { InsiderFeed } from '@/components/markets/insider-feed'
import { RedditActivity } from '@/components/markets/reddit-activity'
import { CorrelationHeatmap } from '@/components/markets/correlation-heatmap'
import { EarningsCalendar } from '@/components/markets/earnings-calendar'
import { OptionsLab } from '@/components/analysis/options-lab'

const TABS = ['overview', 'screener', 'news', 'correlations', 'options'] as const
type Tab = typeof TABS[number]

const TAB_LABELS: Record<Tab, string> = {
  overview:     'Overview',
  screener:     'Screener',
  news:         'News & Signals',
  correlations: 'Correlations',
  options:      'Options Lab',
}

// ── Tab components ────────────────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div className="space-y-6">
      <MarketOverview />
      <TrendingAssets />
    </div>
  )
}

function ScreenerTab() {
  return <Screener />
}

interface NewsItem {
  id: number | string
  headline: string
  summary: string
  source: string
  url: string
  datetime: number
  sentiment: 'positive' | 'negative' | 'neutral'
}

const sentimentStyles = {
  positive: 'bg-green/10 text-green',
  negative: 'bg-red/10 text-red',
  neutral:  'border border-border text-text-secondary',
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

function NewsTab() {
  const [symbol, setSymbol] = useState('SPY')
  const [input,  setInput]  = useState('SPY')

  const { data: news, isLoading: newsLoading } = useSWR<NewsItem[]>(
    '/api/market/news/general?category=general',
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 300_000 }
  )

  function applySymbol() {
    const clean = input.trim().toUpperCase()
    if (clean) setSymbol(clean)
  }

  return (
    <div className="space-y-6">
      {/* General market news */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-text-primary">Market News</h3>
          <Link href="/news" className="text-xs text-brand hover:underline">
            View all →
          </Link>
        </div>

        {newsLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        ) : !news?.length ? (
          <p className="px-5 py-8 text-center text-text-muted text-sm">No news available</p>
        ) : (
          <div className="divide-y divide-border">
            {news.slice(0, 8).map(item => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 px-5 py-3.5 hover:bg-surface-2/50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-text-primary group-hover:text-brand transition-colors line-clamp-2 leading-snug">
                      {item.headline}
                    </p>
                    <ExternalLink className="w-3 h-3 text-text-muted flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-medium px-1.5 py-0.5 ${sentimentStyles[item.sentiment]}`}>
                      {item.sentiment}
                    </span>
                    <span className="text-xs text-text-muted">{item.source}</span>
                    <span className="text-xs text-text-muted">·</span>
                    <span className="text-xs text-text-muted">{timeAgo(new Date(item.datetime * 1000))}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Per-symbol signals */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-text-primary">Symbol Signals</h3>
          <div className="flex gap-2 ml-auto">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applySymbol()}
              placeholder="e.g. AAPL"
              className="input-base w-28 text-xs"
            />
            <button onClick={applySymbol} className="btn-primary text-xs px-3">
              Go
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <InsiderFeed symbol={symbol} />
          <RedditActivity symbol={symbol} />
        </div>
      </div>
    </div>
  )
}

function CorrelationsTab() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CorrelationHeatmap />
        <EarningsCalendar />
      </div>
      <p className="text-xs text-text-muted text-center">
        Correlations based on 90 days of daily returns. Past correlations do not guarantee future relationships.
        Not financial advice.
      </p>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

function AnalysisPageInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const rawTab = searchParams.get('tab')
  const tab: Tab = (TABS as readonly string[]).includes(rawTab ?? '') ? rawTab as Tab : 'overview'

  function setTab(t: Tab) {
    router.replace(`/analysis?tab=${t}`, { scroll: false })
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Analysis</h1>
        <p className="text-text-muted text-sm mt-1">Market overview, screener, market events, and options pricing</p>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 border-b border-border pb-0">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border border-transparent transition-colors -mb-px ${
              tab === t
                ? 'bg-text-primary text-background'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab content — lazy mounted */}
      {tab === 'overview'     && <OverviewTab />}
      {tab === 'screener'     && <ScreenerTab />}
      {tab === 'news'         && <NewsTab />}
      {tab === 'correlations' && <CorrelationsTab />}
      {tab === 'options'      && <OptionsLab />}
    </div>
  )
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={null}>
      <AnalysisPageInner />
    </Suspense>
  )
}
