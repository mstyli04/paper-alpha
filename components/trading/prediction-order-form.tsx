'use client'

import { useState } from 'react'
import { OrderForm } from './order-form'

interface PredictionOrderFormProps {
  conditionId: string
  yesPrice: number
  noPrice: number
  question: string
  onSuccess?: () => void
}

type OutcomeTab = 'YES' | 'NO'

export function PredictionOrderForm({
  conditionId,
  yesPrice,
  noPrice,
  question,
  onSuccess,
}: PredictionOrderFormProps) {
  const [outcome, setOutcome] = useState<OutcomeTab>('YES')

  return (
    <div className="space-y-3">
      {/* YES / NO selector */}
      <div className="card p-4">
        <p className="text-xs text-text-muted mb-3 leading-relaxed">{question}</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setOutcome('YES')}
            className={`py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
              outcome === 'YES'
                ? 'bg-green/10 text-green border-green/40'
                : 'text-text-muted border-border hover:text-green hover:border-green/40'
            }`}
          >
            YES <span className="font-mono ml-1">{(yesPrice * 100).toFixed(0)}¢</span>
          </button>
          <button
            onClick={() => setOutcome('NO')}
            className={`py-2.5 rounded-lg text-sm font-semibold transition-colors border ${
              outcome === 'NO'
                ? 'bg-red/10 text-red border-red/40'
                : 'text-text-muted border-border hover:text-red hover:border-red/40'
            }`}
          >
            NO <span className="font-mono ml-1">{(noPrice * 100).toFixed(0)}¢</span>
          </button>
        </div>
      </div>

      {/* Order form for selected outcome */}
      <OrderForm
        key={outcome}
        symbol={`${conditionId}:${outcome}`}
        assetType="PREDICTION"
        currentPrice={outcome === 'YES' ? yesPrice : noPrice}
        onSuccess={onSuccess}
      />
    </div>
  )
}
