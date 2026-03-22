export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db as prisma } from '@/lib/db'

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const alert = await prisma.priceAlert.findUnique({ where: { id: params.id } })
  if (!alert || alert.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await prisma.priceAlert.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  // Mark alert as seen (clears notification badge)
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const alert = await prisma.priceAlert.findUnique({ where: { id: params.id } })
  if (!alert || alert.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updated = await prisma.priceAlert.update({
    where: { id: params.id },
    data: { seenAt: new Date() },
  })

  return NextResponse.json(updated)
}
