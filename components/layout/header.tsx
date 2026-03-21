'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Search, Bell } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { useSearch } from '@/hooks/use-search'
import type { SearchResult } from '@/types'

export function Header() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const { results, loading } = useSearch(query)
  const router = useRouter()

  function handleSelect(result: SearchResult) {
    setQuery('')
    setOpen(false)
    router.push(`/markets/${result.symbol}?type=${result.assetType}`)
  }

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center px-6 gap-4 sticky top-0 z-20">
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

      <div className="flex items-center gap-3 ml-auto">
        <button className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <UserButton afterSignOutUrl="/" />
      </div>
    </header>
  )
}
