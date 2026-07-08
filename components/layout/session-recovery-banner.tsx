'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { clearClerkSessionCookies } from '@/lib/clerk-session-reset'

// If Clerk hasn't resolved auth state within this window, a stale
// pre-upgrade session cookie is the most likely cause (see
// lib/clerk-session-reset.ts) — offer a one-click way out instead of
// leaving the user staring at a stuck sign-in widget indefinitely.
const STUCK_THRESHOLD_MS = 6000

export function SessionRecoveryBanner() {
  const { isLoaded } = useAuth()
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    if (isLoaded) {
      setStuck(false)
      return
    }
    const timer = setTimeout(() => setStuck(true), STUCK_THRESHOLD_MS)
    return () => clearTimeout(timer)
  }, [isLoaded])

  if (!stuck) return null

  function handleReset() {
    clearClerkSessionCookies(document)
    window.location.reload()
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 card px-4 py-3 flex items-center gap-3">
      <p className="text-sm text-text-secondary">Trouble signing in?</p>
      <button onClick={handleReset} className="btn-secondary text-xs px-3 py-1.5">
        Reset session
      </button>
    </div>
  )
}
