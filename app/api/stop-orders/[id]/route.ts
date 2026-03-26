export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { account: true },
  })
  if (!user?.account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const order = await db.stopOrder.findFirst({
    where: { id, accountId: user.account.id },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.stopOrder.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })

  return NextResponse.json({ success: true })
}
