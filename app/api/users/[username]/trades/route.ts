export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const user = await db.user.findUnique({
    where: { username },
    include: { account: true },
  })

  if (!user?.account) return NextResponse.json([])

  const trades = await db.trade.findMany({
    where: { accountId: user.account.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
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
      note: t.note ?? null,
      createdAt: t.createdAt.toISOString(),
    }))
  )
}
