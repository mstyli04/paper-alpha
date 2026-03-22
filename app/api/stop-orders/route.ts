export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { AssetType, TradeSide } from '@/types'

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { account: true },
  })
  if (!user?.account) return NextResponse.json([])

  const orders = await db.stopOrder.findMany({
    where: { accountId: user.account.id, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(
    orders.map(o => ({
      id: o.id,
      symbol: o.symbol,
      assetType: o.assetType,
      side: o.side,
      triggerPrice: Number(o.triggerPrice),
      condition: o.condition,
      quantity: Number(o.quantity),
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    }))
  )
}

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { symbol, assetType, side, triggerPrice, condition, quantity } = await req.json()
  if (!symbol || !assetType || !side || !triggerPrice || !condition || !quantity) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { account: true },
  })
  if (!user?.account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const order = await db.stopOrder.create({
    data: {
      accountId: user.account.id,
      symbol: symbol.toUpperCase(),
      assetType: assetType as AssetType,
      side: side as TradeSide,
      triggerPrice,
      condition,
      quantity,
    },
  })

  return NextResponse.json({ id: order.id, status: order.status }, { status: 201 })
}
