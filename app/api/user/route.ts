export const dynamic = 'force-dynamic'

import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/user — get or create the current user's record
export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { account: true },
  })

  if (!user) {
    // Fallback: create user if webhook hasn't fired yet
    const clerkUser = await currentUser()
    if (!clerkUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const email = clerkUser.emailAddresses[0]?.emailAddress || ''
    const username =
      clerkUser.username ||
      `${clerkUser.firstName || ''}${clerkUser.lastName || ''}`.trim() ||
      email.split('@')[0] ||
      `user_${userId.slice(-6)}`

    const startingBalance = Number(process.env.STARTING_BALANCE || 100000)

    user = await db.user.create({
      data: {
        clerkId: userId,
        username,
        email,
        avatarUrl: clerkUser.imageUrl,
        account: {
          create: {
            cashBalance: startingBalance,
            startingBalance: startingBalance,
          },
        },
      },
      include: { account: true },
    })
  }

  return NextResponse.json(user)
}

// PATCH /api/user — update username or avatarUrl
export async function PATCH(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Avatar update
  if ('avatarUrl' in body) {
    const { avatarUrl } = body
    if (typeof avatarUrl !== 'string') {
      return NextResponse.json({ error: 'Invalid avatarUrl' }, { status: 400 })
    }
    const user = await db.user.update({
      where: { clerkId: userId },
      data: { avatarUrl },
    })
    return NextResponse.json(user)
  }

  // Username update
  const { username } = body
  if (!username || username.length < 3) {
    return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 })
  }

  const conflict = await db.user.findFirst({ where: { username, NOT: { clerkId: userId } } })
  if (conflict) return NextResponse.json({ error: 'Username already taken' }, { status: 409 })

  const user = await db.user.update({
    where: { clerkId: userId },
    data: { username },
  })

  return NextResponse.json(user)
}
