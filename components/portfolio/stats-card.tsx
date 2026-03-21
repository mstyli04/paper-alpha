import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface StatsCardProps {
  label: string
  value: string
  sub?: string
  subColor?: string
  loading?: boolean
  className?: string
}

export function StatsCard({ label, value, sub, subColor, loading, className }: StatsCardProps) {
  return (
    <div className={cn('card p-5', className)}>
      <p className="stat-label mb-2">{label}</p>
      {loading ? (
        <>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-20" />
        </>
      ) : (
        <>
          <p className="stat-value">{value}</p>
          {sub && <p className={cn('text-sm mt-1', subColor || 'text-text-muted')}>{sub}</p>}
        </>
      )}
    </div>
  )
}
