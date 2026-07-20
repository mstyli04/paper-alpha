export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const StopOrderSchema = z.object({
  symbol: z.string().min(1).max(100).transform((s) => (s.includes(':') ? s : s.toUpperCase())),
  assetType: z.enum(['STOCK', 'CRYPTO', 'COMMODITY', 'PREDICTION']),
  side: z.enum(['BUY', 'SELL', 'SHORT', 'COVER']),
  triggerPrice: z.number().positive(),
  condition: z.enum(['ABOVE', 'BELOW']),
  quantity: z.number().positive(),
})

export async function GET() {
  const { userId } = await auth()
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
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = StopOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { account: true },
  })
  if (!user?.account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const order = await db.stopOrder.create({
    data: {
      accountId: user.account.id,
      symbol: parsed.data.symbol,
      assetType: parsed.data.assetType,
      side: parsed.data.side,
      triggerPrice: parsed.data.triggerPrice,
      condition: parsed.data.condition,
      quantity: parsed.data.quantity,
    },
  })

  return NextResponse.json({ id: order.id, status: order.status }, { status: 201 })
}
