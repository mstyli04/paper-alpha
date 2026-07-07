'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Star } from 'lucide-react'
import { formatCurrency, formatPercent, pnlColor } from '@/lib/utils'
import type { TrendingAsset } from '@/types'

interface AssetRowProps {
  asset: TrendingAsset
  rank?: number
  watched?: boolean
  onToggleWatch?: (e: React.MouseEvent) => void
}

export function AssetRow({ asset, rank, watched, onToggleWatch }: AssetRowProps) {
  return (
    <Link
      href={`/markets/${asset.symbol}?type=${asset.assetType}`}
      className="flex items-center gap-4 px-4 py-3 table-row last:border-0"
    >
      {rank !== undefined && (
        <span className="w-6 text-xs text-text-muted text-center">{rank}</span>
      )}

      <div className="w-9 h-9 rounded-full bg-surface-2 border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
        {asset.logoUrl ? (
          <Image src={asset.logoUrl} alt={asset.symbol} width={36} height={36} className="object-cover" />
        ) : (
          <span className="text-xs font-bold text-text-secondary">{asset.symbol.slice(0, 2)}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">
          {asset.symbol}
          {asset.description && <span className="text-text-muted font-normal"> · {asset.name}</span>}
        </p>
        <p className="text-xs text-text-muted truncate">
          {asset.description ?? asset.name}
        </p>
      </div>

      <div className="text-right">
        <p className="text-sm font-medium text-text-primary font-mono">{formatCurrency(asset.price)}</p>
        <p className={`text-xs font-medium ${pnlColor(asset.changePercent)}`}>
          {formatPercent(asset.changePercent)}
        </p>
      </div>

      {onToggleWatch !== undefined && (
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleWatch(e) }}
          className="p-1.5 hover:bg-surface-2 transition-colors flex-shrink-0"
          aria-label={watched ? 'Remove from watchlist' : 'Add to watchlist'}
        >
          <Star
            className={`w-4 h-4 transition-colors ${watched ? 'fill-yellow-400 text-yellow-400' : 'text-text-muted hover:text-yellow-400'}`}
          />
        </button>
      )}
    </Link>
  )
}
