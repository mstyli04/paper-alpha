export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

interface EarningsEvent {
  symbol: string
  date: string
  epsEstimate: number | null
  revenueEstimate: number | null
  hour: string // 'bmo' before market open, 'amc' after market close, 'dmh' during market hours
}

export async function GET() {
  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

  const today = new Date()
  const from = today.toISOString().split('T')[0]
  const to = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const url = `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${apiKey}`
  const res = await fetch(url, { next: { revalidate: 3600 } })

  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch earnings' }, { status: 500 })

  const data = await res.json()
  const events: EarningsEvent[] = (data.earningsCalendar ?? [])
    .filter((e: { symbol: string }) => e.symbol && !e.symbol.includes('.'))
    .slice(0, 50)
    .map((e: { symbol: string; date: string; epsEstimate: number | null; revenueEstimate: number | null; hour: string }) => ({
      symbol: e.symbol,
      date: e.date,
      epsEstimate: e.epsEstimate ?? null,
      revenueEstimate: e.revenueEstimate ?? null,
      hour: e.hour ?? '',
    }))

  return NextResponse.json(events)
}
