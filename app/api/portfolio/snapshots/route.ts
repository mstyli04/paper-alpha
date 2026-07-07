export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { account: true },
  })

  if (!user?.account) return NextResponse.json([], { status: 200 })

  const snapshots = await db.portfolioSnapshot.findMany({
    where: { accountId: user.account.id },
    orderBy: { createdAt: 'asc' },
    take: 365,
  })

  return NextResponse.json(
    snapshots.map(s => ({
      totalValue: Number(s.totalValue),
      cashBalance: Number(s.cashBalance),
      createdAt: s.createdAt.toISOString(),
    }))
  )
}
