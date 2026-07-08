// __tests__/lib/clerk-session-reset.test.ts
import { describe, it, expect } from 'vitest'
import {
  CLERK_SESSION_COOKIE_NAMES,
  buildExpiredCookieString,
  clearClerkSessionCookies,
  type CookieJar,
} from '@/lib/clerk-session-reset'

describe('buildExpiredCookieString', () => {
  it('builds an already-expired cookie assignment for the given name', () => {
    const result = buildExpiredCookieString('__session')
    expect(result).toBe('__session=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;')
  })
})

describe('clearClerkSessionCookies', () => {
  it('writes an expiring assignment for every known Clerk session cookie', () => {
    const writes: string[] = []
    const jar: CookieJar = {
      get cookie() {
        return ''
      },
      set cookie(value: string) {
        writes.push(value)
      },
    }

    clearClerkSessionCookies(jar)

    expect(writes).toHaveLength(CLERK_SESSION_COOKIE_NAMES.length)
    for (const name of CLERK_SESSION_COOKIE_NAMES) {
      expect(writes.some(w => w.startsWith(`${name}=;`))).toBe(true)
    }
  })
})
