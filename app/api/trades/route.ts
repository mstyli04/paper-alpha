import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { executeTrade } from '@/lib/trading-engine'

const TradeSchema = z.object({
  symbol: z.string().min(1).max(20).toUpperCase(),
  assetType: z.enum(['STOCK', 'CRYPTO']),
  side: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive(),
})

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = TradeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { account: true },
  })

  if (!user?.account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const result = await executeTrade({
    accountId: user.account.id,
    ...parsed.data,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json(result.trade, { status: 201 })
}
