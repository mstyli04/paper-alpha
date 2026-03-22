export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export interface InsiderTransaction {
  name: string
  share: number
  change: number
  filingDate: string
  transactionDate: string
  transactionCode: string
  transactionPrice: number
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })

  const apiKey = process.env.FINNHUB_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 500 })

  const url = `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${symbol.toUpperCase()}&token=${apiKey}`
  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })

  const data = await res.json()
  const transactions: InsiderTransaction[] = (data.data ?? [])
    .filter((t: { transactionCode: string; change: number }) =>
      // P = purchase, S = sale
      (t.transactionCode === 'P' || t.transactionCode === 'S') && t.change !== 0
    )
    .slice(0, 15)
    .map((t: { name: string; share: number; change: number; filingDate: string; transactionDate: string; transactionCode: string; transactionPrice: number }) => ({
      name: t.name,
      share: t.share,
      change: t.change,
      filingDate: t.filingDate,
      transactionDate: t.transactionDate,
      transactionCode: t.transactionCode,
      transactionPrice: t.transactionPrice,
    }))

  return NextResponse.json(transactions)
}
