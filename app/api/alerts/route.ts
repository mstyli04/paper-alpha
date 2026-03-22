export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db as prisma } from '@/lib/db'

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

  const { symbol, assetType, targetPrice, condition } = await req.json()
  if (!symbol || !assetType || !targetPrice || !condition) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  const alert = await prisma.priceAlert.create({
    data: {
      userId: user.id,
      symbol: symbol.toUpperCase(),
      assetType,
      targetPrice,
      condition,
    },
  })

  return NextResponse.json(alert, { status: 201 })
}
