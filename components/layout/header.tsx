'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search, Menu, Sun, Moon } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { useTheme } from 'next-themes'
import { useSearch } from '@/hooks/use-search'
import { AlertsDropdown } from '@/components/alerts/alerts-dropdown'
import type { SearchResult } from '@/types'

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const { results, loading } = useSearch(query)
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  function handleSelect(result: SearchResult) {
    setQuery('')
    setOpen(false)
    router.push(`/markets/${result.symbol}?type=${result.assetType}`)
  }

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center px-4 gap-3 sticky top-0 z-20">
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors flex-shrink-0"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder="Search stocks & crypto..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onFocus={() => query && setOpen(true)}
          className="w-full bg-surface-2 border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand transition-colors"
        />
        {open && query.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden z-50">
            {loading ? (
              <div className="px-4 py-3 text-sm text-text-muted">Searching...</div>
            ) : results.length === 0 ? (
              <div className="px-4 py-3 text-sm text-text-muted">No results found</div>
            ) : (
              results.slice(0, 8).map(r => (
                <button
                  key={`${r.symbol}-${r.assetType}`}
                  onMouseDown={() => handleSelect(r)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{r.symbol}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-surface-2 text-text-muted border border-border">
                        {r.assetType === 'CRYPTO' ? 'Crypto' : 'Stock'}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted truncate">{r.name}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors"
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
