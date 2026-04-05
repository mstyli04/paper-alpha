import { Redis } from '@upstash/redis'

let _redis: Redis | null = null

/**
 * Returns a shared Upstash Redis client, or null if env vars are not set.
 * Returning null allows rate limiting and caching to degrade gracefully in
 * local dev without requiring a Redis instance.
 */
export function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return _redis
}
