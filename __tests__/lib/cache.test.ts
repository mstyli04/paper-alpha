import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/redis', () => ({
  getRedis: vi.fn(),
}))

import { getRedis } from '@/lib/redis'
import { withCache } from '@/lib/cache'

const mockGetRedis = vi.mocked(getRedis)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('withCache', () => {
  it('calls fn() directly when Redis is not configured', async () => {
    mockGetRedis.mockReturnValue(null)
    const fn = vi.fn().mockResolvedValue({ price: 100 })

    const result = await withCache('market:quote:AAPL', 60, fn)

    expect(fn).toHaveBeenCalledOnce()
    expect(result).toEqual({ price: 100 })
  })

  it('returns cached value and skips fn() when key exists in Redis', async () => {
    const mockRedis = { get: vi.fn().mockResolvedValue({ price: 200 }), set: vi.fn() } as any
    mockGetRedis.mockReturnValue(mockRedis)
    const fn = vi.fn()

    const result = await withCache('market:quote:AAPL', 60, fn)

    expect(fn).not.toHaveBeenCalled()
    expect(result).toEqual({ price: 200 })
    expect(mockRedis.set).not.toHaveBeenCalled()
  })

  it('calls fn(), stores result, and returns it when key is missing', async () => {
    const mockRedis = { get: vi.fn().mockResolvedValue(null), set: vi.fn() } as any
    mockGetRedis.mockReturnValue(mockRedis)
    const fn = vi.fn().mockResolvedValue({ price: 300 })

    const result = await withCache('market:quote:TSLA', 60, fn)

    expect(fn).toHaveBeenCalledOnce()
    expect(mockRedis.set).toHaveBeenCalledWith('market:quote:TSLA', { price: 300 }, { ex: 60 })
    expect(result).toEqual({ price: 300 })
  })

  it('uses the correct TTL when storing', async () => {
    const mockRedis = { get: vi.fn().mockResolvedValue(null), set: vi.fn() } as any
    mockGetRedis.mockReturnValue(mockRedis)
    const fn = vi.fn().mockResolvedValue('data')

    await withCache('market:overview', 300, fn)

    expect(mockRedis.set).toHaveBeenCalledWith('market:overview', 'data', { ex: 300 })
  })
})
