'use client'

import { CorrelationHeatmap } from '@/components/markets/correlation-heatmap'
import { Screener } from '@/components/markets/screener'
import { EarningsCalendar } from '@/components/markets/earnings-calendar'
import { MarketOverview } from '@/components/markets/market-overview'

export default function AnalysisPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Analysis</h1>
        <p className="text-text-muted text-sm mt-1">Market overview, screener, and market events</p>
      </div>

      <MarketOverview />

      <Screener />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EarningsCalendar />
        <CorrelationHeatmap />
      </div>

      <p className="text-xs text-text-muted text-center">
        Correlations based on 90 days of daily returns. Past correlations do not guarantee future relationships.
        Not financial advice.
      </p>
    </div>
  )
}
