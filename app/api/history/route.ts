export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page = Number(searchParams.get('page') || 1)
  const limit = Math.min(Number(searchParams.get('limit') || 50), 100)
  const symbol = searchParams.get('symbol') || undefined
  const side = searchParams.get('side') as 'BUY' | 'SELL' | null

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { account: true },
  })

  if (!user?.account) return NextResponse.json({ trades: [], total: 0 })

  const where = {
    accountId: user.account.id,
    ...(symbol ? { symbol: symbol.toUpperCase() } : {}),
    ...(side ? { side } : {}),
  }

  const [trades, total] = await Promise.all([
    db.trade.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.trade.count({ where }),
  ])

  return NextResponse.json({
    trades: trades.map(t => ({
      id: t.id,
      symbol: t.symbol,
      assetType: t.assetType,
      assetName: t.assetName,
      side: t.side,
      quantity: Number(t.quantity),
      price: Number(t.price),
      totalValue: Number(t.totalValue),
      note: t.note ?? null,
      reason: t.reason ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}
