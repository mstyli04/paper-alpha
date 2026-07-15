'use client'

import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'

const defaultButtonClassName = 'p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-2 transition-colors'

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  // next-themes can't know the real theme during server rendering, so
  // `theme` is undefined on the server and on the client's first render —
  // rendering an icon based on it before mount causes a server/client
  // hydration mismatch (React error #418) that can break interactivity for
  // the whole page, worst on statically-generated pages like the landing
  // page where every first-time visitor hits the same mismatch.
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <button className={className ?? defaultButtonClassName} aria-label="Toggle theme" disabled />
  }

  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className={className ?? defaultButtonClassName}
      aria-label="Toggle theme"
    >
      {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}
