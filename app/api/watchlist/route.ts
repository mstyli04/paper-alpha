export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { AssetType } from '@/types'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json([])

  const watchlist = await db.watchlistItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(watchlist)
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { symbol, assetType } = await req.json()
  if (!symbol || !assetType) return NextResponse.json({ error: 'symbol and assetType required' }, { status: 400 })

  const user = await db.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const item = await db.watchlistItem.upsert({
    where: { userId_symbol: { userId: user.id, symbol: symbol.toUpperCase() } },
    create: { userId: user.id, symbol: symbol.toUpperCase(), assetType: assetType as AssetType },
    update: {},
  })

  return NextResponse.json(item, { status: 201 })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })

  const user = await db.user.findUnique({ where: { clerkId: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  await db.watchlistItem.deleteMany({
    where: { userId: user.id, symbol: symbol.toUpperCase() },
  })

  return NextResponse.json({ success: true })
}
