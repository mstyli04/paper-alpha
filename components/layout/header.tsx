'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Search, Menu, Sun, Moon } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { useTheme } from 'next-themes'
import { useSearch } from '@/hooks/use-search'
import { AlertsDropdown } from '@/components/alerts/alerts-dropdown'
import type { SearchResult } from '@/types'

interface HeaderProps {
  onMenuClick?: () => void
}

function useMarketStatus() {
  const [time, setTime] = useState<Date | null>(null)

  useEffect(() => {
    setTime(new Date())
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!time) return { isOpen: false, utcTime: '--:--:--' }

  // NYSE hours: 9:30am–4:00pm ET, Mon–Fri
  const et = new Date(time.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = et.getDay()
  const h = et.getHours()
  const m = et.getMinutes()
  const mins = h * 60 + m
  const isWeekday = day >= 1 && day <= 5
  const isOpen = isWeekday && mins >= 9 * 60 + 30 && mins < 16 * 60

  const utcTime = time.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return { isOpen, utcTime }
}

export function Header({ onMenuClick }: HeaderProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const { results, loading } = useSearch(query)
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const { isOpen: marketOpen, utcTime } = useMarketStatus()

  function handleSelect(result: SearchResult) {
    setQuery('')
    setOpen(false)
    router.push(`/markets/${result.symbol}?type=${result.assetType}`)
  }

  return (
    <header className="h-14 bg-surface border-b-2 border-border flex items-center px-4 gap-3 sticky top-0 z-20">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors flex-shrink-0"
        aria-label="Open menu"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
        <input
          type="text"
          placeholder="Search symbol..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onFocus={() => query && setOpen(true)}
          className="w-full bg-surface-2 border-2 border-border pl-8 pr-4 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-green transition-colors"
        />
        {open && query.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface border-2 border-border overflow-hidden z-50">
            {loading ? (
              <div className="px-4 py-3 text-xs text-text-muted">Searching...</div>
            ) : results.length === 0 ? (
              <div className="px-4 py-3 text-xs text-text-muted">No results found</div>
            ) : (
              results.slice(0, 8).map(r => (
                <button
                  key={`${r.symbol}-${r.assetType}`}
                  onMouseDown={() => handleSelect(r)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors text-left border-b border-border/50 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary font-mono">{r.symbol}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-2 text-text-muted border border-border uppercase tracking-wide">
                        {r.assetType === 'CRYPTO' ? 'Crypto' : r.assetType === 'COMMODITY' ? 'Commodity' : 'Stock'}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted truncate mt-0.5">{r.name}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Market status + clock */}
      <div className="hidden md:flex items-center gap-4 ml-2">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${marketOpen ? 'bg-green' : 'bg-text-muted'}`} />
          <span className="text-xs text-text-muted">
            NYSE <span className={`font-medium ${marketOpen ? 'text-green' : 'text-text-secondary'}`}>{marketOpen ? 'OPEN' : 'CLOSED'}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-brand" />
          <span className="text-xs text-text-muted">
            CRYPTO <span className="font-medium text-brand">24/7</span>
          </span>
        </div>
        <span className="text-xs font-mono text-text-muted tabular-nums">{utcTime} UTC</span>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <AlertsDropdown />
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  )
}
