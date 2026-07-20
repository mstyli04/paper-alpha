import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Reuses UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN, which were
// already provisioned in every Vercel environment but unused until now.
const redis = Redis.fromEnv()

export type RateLimitTier = 'strict' | 'moderate' | 'lenient'

// strict: the Anthropic-backed AI commentary endpoint — costs real money per call.
// moderate: mutations (place/cancel trades, orders, alerts, watchlist, reset).
// lenient: read-only market data / portfolio reads, polled by SWR every 15-300s.
const limiters: Record<RateLimitTier, Ratelimit> = {
  strict: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 h'),
    prefix: 'ratelimit:strict',
    analytics: false,
  }),
  moderate: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(25, '1 m'),
    prefix: 'ratelimit:moderate',
    analytics: false,
  }),
  lenient: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    prefix: 'ratelimit:lenient',
    analytics: false,
  }),
}

const MUTATION_PATH_PREFIXES = [
  '/api/trades',
  '/api/stop-orders',
  '/api/portfolio/reset',
  '/api/alerts',
  '/api/watchlist',
]
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// cron/admin/webhooks are excluded — they carry their own bearer-token or
// Svix-signature auth (see middleware.ts + each route) and aren't user-facing.
const UNRATED_PREFIXES = ['/api/cron', '/api/admin', '/api/webhooks']

export function resolveRateLimitTier(pathname: string, method: string): RateLimitTier | null {
  if (!pathname.startsWith('/api/')) return null
  if (UNRATED_PREFIXES.some((p) => pathname.startsWith(p))) return null

  if (pathname === '/api/market/commentary') return 'strict'

  if (MUTATING_METHODS.has(method) && MUTATION_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return 'moderate'
  }

  return 'lenient'
}

export interface RateLimitCheck {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

const CHECK_TIMEOUT_MS = 2000

// Fails open (allows the request) if Redis is unreachable or slow —
// availability of the live app matters more than strict enforcement during a
// Redis blip. Bounded by a short timeout so a hung/unreachable Redis adds at
// most ~2s to a request instead of stalling on whatever fetch's own default
// timeout is (observed: a bad host can take several seconds to fail on its
// own, which would otherwise land directly on every rate-limited request).
export async function checkRateLimit(tier: RateLimitTier, identity: string): Promise<RateLimitCheck> {
  try {
    return await Promise.race([
      limiters[tier].limit(identity),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`rate-limit check timed out after ${CHECK_TIMEOUT_MS}ms`)), CHECK_TIMEOUT_MS)
      ),
    ])
  } catch (err) {
    console.error(`[rate-limit] Redis check failed for tier=${tier}, failing open:`, err)
    return { success: true, limit: 0, remaining: 0, reset: Date.now() }
  }
}
