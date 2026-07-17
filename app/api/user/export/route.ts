export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/user/export — GDPR Art. 20 data portability: download every record
// we hold about the signed-in user as a single JSON document.
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: {
      account: {
        include: {
          holdings: true,
          trades: true,
          snapshots: true,
          stopOrders: true,
        },
      },
      watchlist: true,
      alerts: true,
    },
  })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    format: 'paper-alpha-user-export/v1',
    profile: {
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    },
    account: user.account
      ? {
          cashBalance: user.account.cashBalance,
          startingBalance: user.account.startingBalance,
          createdAt: user.account.createdAt,
          holdings: user.account.holdings,
          trades: user.account.trades,
          portfolioSnapshots: user.account.snapshots,
          stopOrders: user.account.stopOrders,
        }
      : null,
    watchlist: user.watchlist,
    priceAlerts: user.alerts,
  }

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="paper-alpha-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}
