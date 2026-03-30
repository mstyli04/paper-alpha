import { db } from '@/lib/db'
import { BotRunsList } from './bot-runs-list'

export default async function BotLogsPage() {
  const runs = await db.botRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 30,
    include: { assets: true },
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Bot Runs</h1>
        <p className="text-text-muted text-sm mt-1">Nightly algorithm run history — last 90 days</p>
      </div>

      {runs.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-text-muted text-sm">No bot runs recorded yet.</p>
          <p className="text-text-muted text-xs mt-1">Runs will appear here after the first nightly cron execution.</p>
        </div>
      ) : (
        <BotRunsList runs={runs} />
      )}
    </div>
  )
}
