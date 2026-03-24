export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db as prisma } from '@/lib/db'

const AlertSchema = z.object({
  symbol: z.string().min(1).toUpperCase(),
  assetType: z.enum(['STOCK', 'CRYPTO', 'COMMODITY']),
  targetPrice: z.number().positive(),
  condition: z.enum(['ABOVE', 'BELOW']),
})

export async function GET() {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const alerts = await prisma.priceAlert.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(alerts)
}

export async function POST(req: Request) {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = AlertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const { symbol, assetType, targetPrice, condition } = parsed.data

  const alert = await prisma.priceAlert.create({
    data: {
      userId: user.id,
      symbol,
      assetType,
      targetPrice,
      condition,
    },
  })

  return NextResponse.json(alert, { status: 201 })
}
