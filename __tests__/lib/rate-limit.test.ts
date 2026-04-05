import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @upstash/ratelimit before importing the module under test
vi.mock('@upstash/ratelimit', () => {
  const mockLimit = vi.fn()
  const Ratelimit = vi.fn().mockImplementation(function () { return { limit: mockLimit } })
  Ratelimit.slidingWindow = vi.fn().mockReturnValue('sliding-window-config')
  return { Ratelimit, _mockLimit: mockLimit }
})

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(),
}))

import { getRedis } from '@/lib/redis'
import { checkRateLimit, makeLimiter } from '@/lib/rate-limit'
import { Ratelimit } from '@upstash/ratelimit'

const mockGetRedis = vi.mocked(getRedis)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('makeLimiter', () => {
  it('returns null when Redis is not configured', () => {
    mockGetRedis.mockReturnValue(null)
    const limiter = makeLimiter(10, '1 m')
    expect(limiter).toBeNull()
  })

  it('returns a Ratelimit instance when Redis is configured', () => {
    mockGetRedis.mockReturnValue({} as any)
    const limiter = makeLimiter(10, '1 m')
    expect(limiter).not.toBeNull()
    expect(Ratelimit).toHaveBeenCalledWith({
      redis: {},
      limiter: 'sliding-window-config',
      prefix: 'rl',
    })
  })
})

describe('checkRateLimit', () => {
  it('returns null when limiter is null (Redis not configured)', async () => {
    const result = await checkRateLimit(null, 'user_123')
    expect(result).toBeNull()
  })

  it('returns the rate limit result from the limiter', async () => {
    const mockResult = { success: false, limit: 10, remaining: 0, reset: Date.now() + 60000 }
    const mockLimiter = { limit: vi.fn().mockResolvedValue(mockResult) } as any
    const result = await checkRateLimit(mockLimiter, 'user_123')
    expect(result).toEqual(mockResult)
    expect(mockLimiter.limit).toHaveBeenCalledWith('user_123')
  })

  it('returns success result when under the limit', async () => {
    const mockResult = { success: true, limit: 10, remaining: 9, reset: Date.now() + 60000 }
    const mockLimiter = { limit: vi.fn().mockResolvedValue(mockResult) } as any
    const result = await checkRateLimit(mockLimiter, 'user_abc')
    expect(result?.success).toBe(true)
    expect(result?.remaining).toBe(9)
  })
})
