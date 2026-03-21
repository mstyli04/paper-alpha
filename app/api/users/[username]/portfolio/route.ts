export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getPortfolio } from '@/lib/portfolio'

export async function GET(_req: Request, { params }: { params: { username: string } }) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({
    where: { username: params.username },
    include: { account: true },
  })

  if (!user?.account) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  try {
    const portfolio = await getPortfolio(user.account.id)
    return NextResponse.json({ user: { username: user.username, avatarUrl: user.avatarUrl }, portfolio })
  } catch {
    return NextResponse.json({ error: 'Failed to load portfolio' }, { status: 500 })
  }
}
