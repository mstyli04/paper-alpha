'use client'

import { Screener } from '@/components/markets/screener'

export default function ScreenerPage() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-text-primary tracking-tight">Stock Screener</h1>
        <p className="text-xs text-text-muted mt-0.5">Filter and sort stocks by sector, price, and performance</p>
      </div>
      <Screener />
    </div>
  )
}
