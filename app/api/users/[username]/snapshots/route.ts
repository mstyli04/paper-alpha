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
