export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const trades = await db.trade.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: {
      account: {
        include: { user: true },
      },
    },
  })

  return NextResponse.json(
    trades.map(t => ({
      id: t.id,
      symbol: t.symbol,
      assetType: t.assetType,
      assetName: t.assetName,
      side: t.side,
      quantity: Number(t.quantity),
      price: Number(t.price),
      totalValue: Number(t.totalValue),
      createdAt: t.createdAt.toISOString(),
      username: t.account.user.username,
      avatarUrl: t.account.user.avatarUrl ?? null,
    }))
  )
}
