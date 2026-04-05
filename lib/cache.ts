import { getRedis } from '@/lib/redis'

/**
 * Cache-aside helper. Checks Redis for `key`; on miss, calls `fn()`, stores
 * the result with `ttlSeconds` expiry, and returns it.
 * Falls through to `fn()` directly when Redis is not configured.
 */
export async function withCache<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const redis = getRedis()
  if (!redis) return fn()

  const cached = await redis.get<T>(key)
  if (cached !== null) return cached

  const result = await fn()
  await redis.set(key, result, { ex: ttlSeconds })
  return result
}
