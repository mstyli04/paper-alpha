import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | undefined | null): string {
  const n = value ?? 0
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: n < 1 && n > -1 ? 6 : 2,
  }).format(n)
}

export function formatPercent(value: number | undefined | null): string {
  const n = value ?? 0
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

export function formatQuantity(value: number | undefined | null, assetType: 'STOCK' | 'CRYPTO' | 'COMMODITY'): string {
  const n = value ?? 0
  if (assetType === 'CRYPTO') return n.toFixed(6)
  return n.toFixed(4)
}

export function formatMarketCap(value: number | undefined | null): string {
  return formatCurrency(value)
}

export function pnlColor(value: number | undefined | null): string {
  const n = value ?? 0
  if (n > 0) return 'text-green'
  if (n < 0) return 'text-red'
  return 'text-text-muted'
}

export function timeAgo(dateStr: string | Date): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function timeAgoDate(date: Date | string): string {
  return timeAgo(typeof date === 'string' ? date : date.toISOString())
}
