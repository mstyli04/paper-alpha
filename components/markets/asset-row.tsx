'use client'

import Link from 'next/link'
import Image from 'next/image'
import { formatCurrency, formatPercent, pnlColor } from '@/lib/utils'
import type { TrendingAsset } from '@/types'

interface AssetRowProps {
  asset: TrendingAsset
  rank?: number
}

export function AssetRow({ asset, rank }: AssetRowProps) {
  return (
    <Link
      href={`/markets/${asset.symbol}?type=${asset.assetType}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-surface-2/50 transition-colors border-b border-border last:border-0"
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
        <p className="text-sm font-medium text-text-primary">{asset.symbol}</p>
        <p className="text-xs text-text-muted truncate">{asset.name}</p>
      </div>

      <div className="text-right">
        <p className="text-sm font-medium text-text-primary font-mono">{formatCurrency(asset.price)}</p>
        <p className={`text-xs font-medium ${pnlColor(asset.changePercent)}`}>
          {formatPercent(asset.changePercent)}
        </p>
      </div>
    </Link>
  )
}
