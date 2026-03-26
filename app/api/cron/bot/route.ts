export const dynamic = 'force-dynamic'
export const maxDuration = 60 // seconds

import { NextResponse } from 'next/server'
import { runBot } from '@/lib/bot/bot-runner'

// Called daily by Vercel Cron at 09:30 UTC. Protected by CRON_SECRET.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const botAccountId = process.env.BOT_ACCOUNT_ID
  if (!botAccountId) {
    return NextResponse.json({ error: 'BOT_ACCOUNT_ID not configured' }, { status: 500 })
  }

  try {
    const result = await runBot(botAccountId)
    return NextResponse.json({
      ok: true,
      tradesExecuted: result.tradesExecuted,
      skipped:        result.skipped,
      errors:         result.errors,
      timestamp:      new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
