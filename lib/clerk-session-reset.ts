// Recovery path for the Clerk 5→7 upgrade cookie-format break: a browser
// holding a session cookie written by the pre-upgrade SDK can get stuck in
// an unresolvable handshake with the new SDK, so the sign-in widget never
// finishes loading. Clearing these cookies lets it start a clean session.
export const CLERK_SESSION_COOKIE_NAMES = ['__session', '__client_uat', '__clerk_db_jwt'] as const

export function buildExpiredCookieString(name: string): string {
  return `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`
}

export interface CookieJar {
  cookie: string
}

export function clearClerkSessionCookies(jar: CookieJar): void {
  for (const name of CLERK_SESSION_COOKIE_NAMES) {
    jar.cookie = buildExpiredCookieString(name)
  }
}
