import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'green' | 'red' | 'neutral' | 'brand'
  className?: string
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full',
        variant === 'green' && 'bg-green/10 text-green',
        variant === 'red' && 'bg-red/10 text-red',
        variant === 'neutral' && 'bg-transparent text-text-secondary border border-border',
        variant === 'brand' && 'bg-brand/10 text-brand',
        className
      )}
    >
      {children}
    </span>
  )
}
