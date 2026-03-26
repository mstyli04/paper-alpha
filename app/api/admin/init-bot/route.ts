import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const BOT_CLERK_ID = 'bot_alpha_momentum'
const BOT_USERNAME = 'AlphaBot'
const BOT_EMAIL = 'alphabot@paper-alpha.internal'

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authHeader = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  try {
    if (
      authHeader.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const existing = await db.user.findUnique({ where: { clerkId: BOT_CLERK_ID } })
  if (existing) {
    return NextResponse.json({ message: 'Bot already exists', username: existing.username })
  }

  const startingBalance = parseFloat(process.env.STARTING_BALANCE ?? '100000')

  const user = await db.user.create({
    data: {
      clerkId: BOT_CLERK_ID,
      username: BOT_USERNAME,
      email: BOT_EMAIL,
      account: {
        create: {
          cashBalance: startingBalance,
          startingBalance,
        },
      },
    },
  })

  return NextResponse.json({ message: 'Bot created', username: user.username })
}
