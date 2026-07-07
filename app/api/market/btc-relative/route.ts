export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getCryptoCandles } from '@/lib/market-data/coingecko'

function returnOver(closes: number[], days: number): number | null {
  if (closes.length < 2) return null
  const recent = closes[closes.length - 1]
  const past = closes[Math.max(0, closes.length - 1 - days)]
  if (!past || past === 0) return null
  return ((recent - past) / past) * 100
}

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')
  if (!symbol || symbol.toUpperCase() === 'BTC') {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 })
  }

  const to = Math.floor(Date.now() / 1000)
  const from = to - 91 * 86400

  const [assetResult, btcResult] = await Promise.allSettled([
    getCryptoCandles(symbol, 'D', from, to),
    getCryptoCandles('BTC', 'D', from, to),
  ])

  if (assetResult.status === 'rejected' || btcResult.status === 'rejected') {
    return NextResponse.json({ error: 'Failed to fetch candle data' }, { status: 500 })
  }

  const assetCloses = assetResult.value.map(c => c.close)
  const btcCloses = btcResult.value.map(c => c.close)

  const timeframes = [
    { label: '1D', days: 1 },
    { label: '1W', days: 7 },
    { label: '1M', days: 30 },
    { label: '3M', days: 90 },
  ]

  const data = timeframes.map(({ label, days }) => {
    const assetReturn = returnOver(assetCloses, days)
    const btcReturn = returnOver(btcCloses, days)
    if (assetReturn === null || btcReturn === null) return { label, assetReturn: null, btcReturn: null, relativeStrength: null }
    return {
      label,
      assetReturn: +assetReturn.toFixed(2),
      btcReturn: +btcReturn.toFixed(2),
      relativeStrength: +(assetReturn - btcReturn).toFixed(2),
    }
  })

  return NextResponse.json({ symbol: symbol.toUpperCase(), data })
}
