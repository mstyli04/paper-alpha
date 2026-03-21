'use client'

import { CorrelationHeatmap } from '@/components/markets/correlation-heatmap'

export default function AnalysisPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Analysis</h1>
        <p className="text-text-muted text-sm mt-1">Correlation analysis and market insights</p>
      </div>

      <CorrelationHeatmap />

      <p className="text-xs text-text-muted text-center">
        Correlations based on 90 days of daily returns. Past correlations do not guarantee future relationships.
        Not financial advice.
      </p>
    </div>
  )
}
