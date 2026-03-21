import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPortfolio } from '@/lib/portfolio'

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { account: true },
  })

  if (!user?.account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  try {
    const portfolio = await getPortfolio(user.account.id)
    return NextResponse.json(portfolio)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load portfolio'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
