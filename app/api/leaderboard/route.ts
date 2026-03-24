export const revalidate = 60

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getLeaderboard } from '@/lib/portfolio'

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const leaderboard = await getLeaderboard()
    return NextResponse.json(leaderboard)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
