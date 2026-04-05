import { Ratelimit } from '@upstash/ratelimit'
import { getRedis } from '@/lib/redis'

type Window = `${number} s` | `${number} m` | `${number} h`

/**
 * Creates a sliding-window rate limiter, or returns null if Redis is not configured.
 * Call once at module level per route to avoid re-creating on every request.
 */
export function makeLimiter(requests: number, window: Window): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix: 'rl',
  })
}

/**
 * Checks a rate limit for the given identifier (Clerk userId).
 * Returns null if limiter is null (Redis not configured) — callers treat null as "allowed".
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ success: boolean; limit: number; remaining: number; reset: number } | null> {
  if (!limiter) return null
  return limiter.limit(identifier)
}
