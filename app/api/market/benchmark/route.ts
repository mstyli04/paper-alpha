export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'
const yahooFinance = new YahooFinance()

export async function GET(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol') || 'SPY'
  const fromParam = searchParams.get('from')
  const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 365 * 86400 * 1000)

  try {
    const result = await yahooFinance.chart(
      symbol,
      { period1: from, period2: new Date(), interval: '1d' },
      { validateResult: false }
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quotes = (result as any)?.quotes ?? []
    const data = quotes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((q: any) => q.close !== null && q.close !== undefined)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((q: any) => ({
        time: Math.floor(new Date(q.date).getTime() / 1000),
        close: Number(q.close),
      }))

    return NextResponse.json(data)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
