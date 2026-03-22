export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db as prisma } from '@/lib/db'
import { getStockQuote } from '@/lib/market-data/finnhub'
import { getCryptoQuote } from '@/lib/market-data/coingecko'

export async function POST() {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Get active (non-triggered) alerts for this user
  const alerts = await prisma.priceAlert.findMany({
    where: { userId: user.id, triggered: false },
  })

  if (alerts.length === 0) {
    return NextResponse.json({ triggered: [] })
  }

  // Group by symbol to avoid duplicate API calls
  const symbolMap = new Map<string, { assetType: string; price?: number }>()
  for (const alert of alerts) {
    if (!symbolMap.has(alert.symbol)) {
      symbolMap.set(alert.symbol, { assetType: alert.assetType })
    }
  }

  // Fetch current prices
  for (const [symbol, info] of Array.from(symbolMap.entries())) {
    try {
      let price: number | undefined
      if (info.assetType === 'CRYPTO') {
        const quote = await getCryptoQuote(symbol)
        price = quote?.price
      } else {
        const quote = await getStockQuote(symbol)
        price = quote?.price
      }
      info.price = price
    } catch {
      // skip
    }
  }

  // Check each alert
  const nowTriggered: string[] = []
  const updates: Promise<unknown>[] = []

  for (const alert of alerts) {
    const info = symbolMap.get(alert.symbol)
    if (info?.price == null) continue

    const price = info.price
    const target = Number(alert.targetPrice)
    const hit =
      (alert.condition === 'ABOVE' && price >= target) ||
      (alert.condition === 'BELOW' && price <= target)

    if (hit) {
      nowTriggered.push(alert.id)
      updates.push(
        prisma.priceAlert.update({
          where: { id: alert.id },
          data: { triggered: true, triggeredAt: new Date() },
        })
      )
    }
  }

  await Promise.all(updates)

  return NextResponse.json({ triggered: nowTriggered })
}
