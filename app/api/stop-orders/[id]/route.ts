export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { account: true },
  })
  if (!user?.account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const order = await db.stopOrder.findFirst({
    where: { id: params.id, accountId: user.account.id },
  })
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.stopOrder.update({
    where: { id: params.id },
    data: { status: 'CANCELLED' },
  })

  return NextResponse.json({ success: true })
}
