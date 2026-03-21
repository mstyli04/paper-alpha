import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | undefined | null, compact = false): string {
  const v = value ?? 0
  if (compact && Math.abs(v) >= 1_000_000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(v)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

export function formatPercent(value: number | undefined | null): string {
  const v = value ?? 0
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(2)}%`
}

export function formatNumber(value: number | undefined | null, decimals = 6): string {
  const v = value ?? 0
  if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 2 })
  return v.toFixed(decimals).replace(/\.?0+$/, '')
}

export function formatQuantity(value: number | undefined | null, assetType: 'STOCK' | 'CRYPTO'): string {
  if (assetType === 'CRYPTO') return formatNumber(value, 6)
  return formatNumber(value, 4)
}

export function formatMarketCap(value: number | undefined | null): string {
  const v = value ?? 0
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  return formatCurrency(v)
}

export function pnlColor(value: number | undefined | null): string {
  if ((value ?? 0) > 0) return 'text-green'
  if ((value ?? 0) < 0) return 'text-red'
  return 'text-text-secondary'
}

export function pnlBg(value: number | undefined | null): string {
  if ((value ?? 0) > 0) return 'bg-green/10 text-green'
  if ((value ?? 0) < 0) return 'bg-red/10 text-red'
  return 'bg-text-muted/10 text-text-secondary'
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
