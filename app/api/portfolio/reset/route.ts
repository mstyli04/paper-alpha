export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { makeLimiter, checkRateLimit } from '@/lib/rate-limit'

const limiter = makeLimiter(3, '1 h')

export async function POST() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(limiter, userId)
  if (rl && !rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
    )
  }

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { account: true },
  })

  if (!user?.account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const startingBalance = Number(user.account.startingBalance)

  await db.$transaction([
    db.holding.deleteMany({ where: { accountId: user.account.id } }),
    db.trade.deleteMany({ where: { accountId: user.account.id } }),
    db.portfolioSnapshot.deleteMany({ where: { accountId: user.account.id } }),
    db.paperAccount.update({
      where: { id: user.account.id },
      data: { cashBalance: startingBalance },
    }),
  ])

  return NextResponse.json({ success: true })
}
