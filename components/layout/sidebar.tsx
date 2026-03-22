'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  TrendingUp,
  Briefcase,
  Trophy,
  History,
  Settings,
  BarChart2,
  X,
  Activity,
  Newspaper,
  SlidersHorizontal,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navGroups = [
  {
    label: 'Trading',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/markets', label: 'Markets', icon: TrendingUp },
      { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
    ],
  },
  {
    label: 'Research',
    items: [
      { href: '/news', label: 'News', icon: Newspaper },
      { href: '/screener', label: 'Screener', icon: SlidersHorizontal },
      { href: '/analysis', label: 'Analysis', icon: BarChart2 },
    ],
  },
  {
    label: 'Community',
    items: [
      { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
      { href: '/profile', label: 'My Profile', icon: User },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/history', label: 'History', icon: History },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        'fixed left-0 top-0 h-full w-56 bg-surface border-r border-border flex flex-col z-30 transition-transform duration-300',
        'lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-brand rounded-md flex items-center justify-center shrink-0">
              <Activity className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <span className="font-semibold text-text-primary text-sm tracking-tight">Paper Alpha</span>
              <div className="flex items-center gap-1 mt-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse-slow inline-block" />
                <span className="text-[10px] text-text-muted">LIVE</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded text-text-muted hover:text-text-primary"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {navGroups.map(group => (
            <div key={group.label}>
              <p className="px-3 mb-1 text-[10px] font-semibold text-text-muted uppercase tracking-widest">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all relative',
                        active
                          ? 'bg-brand/10 text-brand'
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand rounded-r-full" />
                      )}
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {label}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border shrink-0">
          <div className="px-3 py-2.5 rounded-lg bg-surface-2 border border-border/50">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-brand uppercase tracking-widest">Simulation</span>
              <span className="text-[10px] text-text-muted">v1.0</span>
            </div>
            <p className="text-[10px] text-text-muted leading-relaxed">
              Paper trading only. No real money. Not financial advice.
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
