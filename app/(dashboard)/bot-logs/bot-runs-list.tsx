'use client'

import { useState } from 'react'
import type { BotRun, BotRunAsset } from '@prisma/client'

type RunWithAssets = BotRun & { assets: BotRunAsset[] }
type FilterTab = 'all' | 'traded' | 'skipped' | 'error'

function statusIcon(run: RunWithAssets): string {
  if (!run.finishedAt) return '⏱'
  if (run.status === 'ERROR') return '❌'
  if (run.tradesExecuted > 0) return '✅'
  return '○'
}

function formatRunDate(d: Date): string {
  return new Date(d).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'UTC', hour12: false,
  }) + ' UTC'
}

function AssetTable({ assets }: { assets: BotRunAsset[] }) {
  const [filter, setFilter] = useState<FilterTab>('all')

  const filtered = assets.filter(a => {
    if (filter === 'traded') return a.action === 'BOUGHT' || a.action === 'SOLD'
    if (filter === 'skipped') return a.action === 'SKIPPED'
    if (filter === 'error') return a.action === 'ERROR'
    return true
  })

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all',     label: 'All',     count: assets.length },
    { key: 'traded',  label: 'Traded',  count: assets.filter(a => a.action === 'BOUGHT' || a.action === 'SOLD').length },
    { key: 'skipped', label: 'Skipped', count: assets.filter(a => a.action === 'SKIPPED').length },
    { key: 'error',   label: 'Error',   count: assets.filter(a => a.action === 'ERROR').length },
  ]

  return (
    <div className="px-5 pb-5 space-y-3">
      {/* Filter tabs */}
      <div className="flex gap-1">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={`px-3 py-1 text-xs font-medium border transition-colors ${
              filter === t.key
                ? 'bg-text-primary text-background'
                : 'text-text-secondary border-transparent hover:text-text-primary'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Asset table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left table-head">
              <th className="pb-2 pr-4">Symbol</th>
              <th className="pb-2 pr-4">Regime</th>
              <th className="pb-2 pr-4">Signal</th>
              <th className="pb-2 pr-4">Action</th>
              <th className="pb-2 pr-4">Candles</th>
              <th className="pb-2">Skip Reason / Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {filtered.map(asset => (
              <tr key={asset.id} className="text-text-secondary">
                <td className="py-2 pr-4 font-medium text-text-primary">{asset.symbol}</td>
                <td className="py-2 pr-4">{asset.regime}</td>
                <td className="py-2 pr-4">{asset.signal}</td>
                <td className={`py-2 pr-4 font-medium ${
                  asset.action === 'BOUGHT' || asset.action === 'SOLD' ? 'text-green' :
                  asset.action === 'ERROR' ? 'text-red' : ''
                }`}>{asset.action}</td>
                <td className="py-2 pr-4 font-mono">{asset.candleCount}</td>
                <td className="py-2 text-text-muted max-w-[200px] break-words">{asset.skipReason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-text-muted py-4">No assets in this category.</p>
        )}
      </div>
    </div>
  )
}

export function BotRunsList({ runs }: { runs: RunWithAssets[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="card overflow-hidden divide-y divide-border">
      {runs.map(run => {
        const expanded = expandedId === run.id
        const icon = statusIcon(run)

        return (
          <div key={run.id}>
            {/* Run row */}
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpandedId(expanded ? null : run.id)}
              className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-surface-2/50 transition-colors text-left"
            >
              <span className="text-base w-5 flex-shrink-0">{icon}</span>
              <span className="text-sm text-text-primary flex-1">
                {formatRunDate(run.startedAt)}
              </span>
              <span className={`text-xs font-medium px-2 py-0.5 ${
                !run.finishedAt ? 'bg-yellow-500 text-white' :
                run.status === 'ERROR' ? 'bg-red/10 text-red' :
                'bg-green/10 text-green'
              }`}>
                {!run.finishedAt ? 'TIMEOUT' : run.status}
              </span>
              <span className="text-sm text-text-muted w-28 text-right">
                {run.tradesExecuted} trade{run.tradesExecuted !== 1 ? 's' : ''}
              </span>
              <span className="text-sm text-text-muted w-28 text-right">
                {run.finishedAt ? `${run.skipped} skipped` : '—'}
              </span>
              <span className="text-text-muted text-xs ml-2">{expanded ? '▲' : '▼'}</span>
            </button>

            {/* Expanded per-asset table */}
            {expanded && (
              <div className="bg-surface-2/30 border-t border-border">
                {run.errors.length > 0 && (
                  <div className="mx-5 mt-4 p-3 border border-red text-xs text-red space-y-1">
                    {run.errors.map((e, i) => <p key={`${i}-${e}`} className="break-words">{e}</p>)}
                  </div>
                )}
                <AssetTable assets={run.assets} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
