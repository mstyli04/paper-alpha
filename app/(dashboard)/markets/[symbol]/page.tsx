'use client'

import { useParams, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import useSWR from 'swr'
import Image from 'next/image'
import { ArrowUpRight, ArrowDownRight, Star, StarOff } from 'lucide-react'
import { useQuote } from '@/hooks/use-quote'
import { useWatchlist } from '@/hooks/use-watchlist'
import { usePortfolio } from '@/hooks/use-portfolio'
import { OrderForm } from '@/components/trading/order-form'
import { PriceChart } from '@/components/charts/price-chart'
import type { TradeMarker } from '@/components/charts/price-chart'
import { NewsFeed } from '@/components/markets/news-feed'
import { VolatilityMetrics } from '@/components/markets/volatility-metrics'
import { RedditActivity } from '@/components/markets/reddit-activity'
import { AlertForm } from '@/components/markets/alert-form'
import { AICommentary } from '@/components/markets/ai-commentary'
import { BtcRelativeStrength } from '@/components/markets/btc-relative-strength'
import { InsiderFeed } from '@/components/markets/insider-feed'
import { StopOrderForm } from '@/components/trading/stop-order-form'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatPercent, formatMarketCap, pnlColor } from '@/lib/utils'
import type { AssetType, CandleData } from '@/types'

type Range = '1D' | '1W' | '1M' | '3M' | '1Y'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function AssetDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const symbol = (params.symbol as string).toUpperCase()
  const assetType = (searchParams.get('type') || 'STOCK') as AssetType
  const [range, setRange] = useState<Range>('1M')
  const [chartType, setChartType] = useState<'area' | 'candlestick'>('area')

  const { quote, isLoading: quoteLoading } = useQuote(symbol, assetType)
  const { portfolio } = usePortfolio()
  const { data: candles, isLoading: candlesLoading } = useSWR<CandleData[]>(
    `/api/market/history?symbol=${symbol}&assetType=${assetType}&range=${range}`,
    fetcher
  )
  const { data: tradeHistory } = useSWR<{ trades: Array<{ side: 'BUY' | 'SELL'; quantity: number; price: number; createdAt: string }> }>(
    `/api/history?symbol=${symbol}&limit=100`,
    fetcher
  )
  const trades: TradeMarker[] = (tradeHistory?.trades ?? []).map(t => ({
    time: Math.floor(new Date(t.createdAt).getTime() / 1000),
    side: t.side,
    price: t.price,
    quantity: t.quantity,
  }))

  const { watchedSymbols, toggle: toggleWatchlist } = useWatchlist()
  const inWatchlist = watchedSymbols.has(symbol)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {quote?.logoUrl && (
            <div className="w-12 h-12 rounded-full bg-surface-2 border border-border overflow-hidden flex-shrink-0">
              <Image src={quote.logoUrl} alt={symbol} width={48} height={48} className="object-cover" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-text-primary">{symbol}</h1>
              <span className="text-xs px-2 py-0.5 rounded bg-surface-2 border border-border text-text-muted">
                {assetType === 'CRYPTO' ? 'Crypto' : 'Stock'}
              </span>
            </div>
            {quoteLoading ? (
              <Skeleton className="h-4 w-32 mt-1" />
            ) : (
              <p className="text-text-muted text-sm">{quote?.name}</p>
            )}
          </div>
        </div>

        <button
          onClick={() => toggleWatchlist(symbol, assetType)}
          className="flex items-center gap-1.5 text-sm text-text-muted hover:text-brand transition-colors px-3 py-2 rounded-lg border border-border hover:border-brand"
        >
          {inWatchlist ? <Star className="w-4 h-4 fill-brand text-brand" /> : <StarOff className="w-4 h-4" />}
          {inWatchlist ? 'Watching' : 'Watch'}
        </button>
      </div>

      {/* Price */}
      {quoteLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-5 w-32" />
        </div>
      ) : quote ? (
        <div>
          <p className="text-4xl font-bold text-text-primary font-mono">{formatCurrency(quote.price)}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`flex items-center gap-1 text-sm font-medium ${pnlColor(quote.change)}`}>
              {quote.change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {formatCurrency(Math.abs(quote.change))} ({formatPercent(quote.changePercent)})
            </span>
            <span className="text-xs text-text-muted">Today</span>
          </div>
        </div>
      ) : null}

      {/* Chart + Order form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-5">
          {/* Range selector */}
          <div className="flex items-center gap-1 mb-4">
            {(['1D', '1W', '1M', '3M', '1Y'] as Range[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  range === r ? 'bg-brand/10 text-brand' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {r}
              </button>
            ))}
            {range === '1D' && (
              <span className="ml-2 text-xs text-text-muted bg-surface-2 border border-border px-2 py-0.5 rounded-full">
                1-min intraday
              </span>
            )}
            <div className="ml-auto flex items-center gap-1">
              {(['area', 'candlestick'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setChartType(t)}
                  className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                    chartType === t ? 'bg-brand/10 text-brand' : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {t === 'area' ? 'Area' : 'Candles'}
                </button>
              ))}
            </div>
          </div>

          {candlesLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : candles && candles.length > 0 ? (
            <PriceChart data={candles} type={chartType} height={288} trades={trades} />
          ) : (
            <div className="h-72 flex items-center justify-center text-text-muted text-sm">
              No chart data available
            </div>
          )}
        </div>

        <div className="space-y-4">
          {quote ? (
            <OrderForm symbol={symbol} assetType={assetType} currentPrice={quote.price} />
          ) : (
            <Skeleton className="h-80 w-full rounded-xl" />
          )}

          {/* Price Alert */}
          {quote && (
            <AlertForm symbol={symbol} assetType={assetType} currentPrice={quote.price} />
          )}

          {/* Stop-Loss / Take-Profit */}
          {quote && (
            <StopOrderForm
              symbol={symbol}
              assetType={assetType}
              currentPrice={quote.price}
              holdingQty={portfolio?.holdings.find(h => h.symbol === symbol)?.quantity ?? 0}
            />
          )}

          {/* Stats */}
          {quote && (
            <div className="card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">Market Stats</h3>
              {[
                { label: 'Open', value: formatCurrency(quote.open) },
                { label: "Today's High", value: formatCurrency(quote.high) },
                { label: "Today's Low", value: formatCurrency(quote.low) },
                { label: 'Prev. Close', value: formatCurrency(quote.previousClose) },
                ...(quote.marketCap ? [{ label: 'Market Cap', value: formatMarketCap(quote.marketCap) }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-text-muted">{label}</span>
                  <span className="text-text-primary font-mono">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Commentary */}
      <AICommentary symbol={symbol} assetType={assetType} />

      {/* News + Reddit + Volatility */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <NewsFeed symbol={symbol} assetType={assetType} />
          {assetType === 'STOCK' && <RedditActivity symbol={symbol} />}
        </div>
        <div className="space-y-4">
          <VolatilityMetrics symbol={symbol} assetType={assetType} />
          {assetType === 'CRYPTO' && symbol !== 'BTC' && (
            <BtcRelativeStrength symbol={symbol} />
          )}
          {assetType === 'STOCK' && <InsiderFeed symbol={symbol} />}
        </div>
      </div>
    </div>
  )
}
