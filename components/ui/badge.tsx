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
        'inline-flex items-center text-xs font-bold uppercase tracking-wide px-2 py-0.5',
        variant === 'green' && 'bg-green text-[#0a0a0a]',
        variant === 'red' && 'bg-red text-[#0a0a0a]',
        variant === 'neutral' && 'bg-transparent text-text-secondary border-2 border-border',
        variant === 'brand' && 'bg-brand text-[#0a0a0a]',
        className
      )}
    >
      {children}
    </span>
  )
}
