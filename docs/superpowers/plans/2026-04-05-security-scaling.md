# Security & Scaling Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden paper-alpha with security headers, auth fixes, per-user rate limiting, Redis market data caching, DB connection pooling, and removal of unnecessary per-trade DB writes.

**Architecture:** Upstash Redis serves dual purpose — rate limiting (via `@upstash/ratelimit` sliding window) and market data caching (via a thin `withCache` helper). Both degrade gracefully when Redis env vars are absent. All other changes are config-level with no new runtime dependencies.

**Tech Stack:** Next.js 15, `@upstash/ratelimit`, `@upstash/redis`, Prisma, Vitest

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `next.config.js` | Modify | Add HTTP security headers |
| `middleware.ts` | Modify | Remove `/api/admin(.*)` from public routes |
| `lib/redis.ts` | Create | Shared Upstash Redis singleton (lazy, no-op when unconfigured) |
| `lib/rate-limit.ts` | Create | Per-user rate limit helper using `@upstash/ratelimit` |
| `lib/cache.ts` | Create | `withCache<T>` helper wrapping Redis |
| `__tests__/lib/cache.test.ts` | Create | Unit tests for `withCache` |
| `__tests__/lib/rate-limit.test.ts` | Create | Unit tests for `checkRateLimit` |
| `app/api/trades/route.ts` | Modify | Apply trade rate limit |
| `app/api/portfolio/reset/route.ts` | Modify | Apply reset rate limit |
| `app/api/market/quote/route.ts` | Modify | Apply market rate limit |
| `app/api/market/history/route.ts` | Modify | Apply market rate limit |
| `app/api/market/overview/route.ts` | Modify | Apply market rate limit |
| `app/api/market/screener/route.ts` | Modify | Add auth check + apply market rate limit |
| `app/api/alerts/route.ts` | Modify | Apply alert rate limit |
| `lib/market-data/index.ts` | Modify | Wrap `getQuote` and `getCandles` with `withCache` |
| `lib/market-data/overview.ts` | Modify | Wrap `getIndices`, `getSectors`, `getTopMovers` with `withCache` |
| `lib/trading-engine.ts` | Modify | Remove `saveSnapshot` call and function |
| `prisma/schema.prisma` | Modify | Add `directUrl` for migrations |
| `.env.example` | Modify | Add Upstash and `DIRECT_URL` vars |

---

## Task 1: Install dependencies and update env files

**Files:**
- Modify: `.env.example`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Install Upstash packages**

```bash
cd /home/michael/paper-alpha
npm install @upstash/ratelimit @upstash/redis
```

Expected: packages install without errors, `package.json` updated.

- [ ] **Step 2: Add new env vars to `.env.example`**

Open `.env.example` and append after the `STARTING_BALANCE` line:

```env
# Upstash Redis — free tier at https://console.upstash.com
# Used for rate limiting and market data caching.
# Leave blank to disable both (safe for local dev).
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Prisma direct (unpooled) connection — used for migrations only.
# Same as DATABASE_URL but without ?pgbouncer=true
DIRECT_URL=postgresql://user:password@host:5432/paper_alpha?sslmode=require

# Cron secret — required for /api/cron/* and /api/admin/* routes
CRON_SECRET=your_cron_secret_here
```

- [ ] **Step 3: Add `directUrl` to `prisma/schema.prisma`**

Replace the `datasource db` block (currently lines 5–8):

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json prisma/schema.prisma .env.example
git commit -m "chore: add upstash deps, directUrl for pooling, update env example"
```

---

## Task 2: Add HTTP security headers

**Files:**
- Modify: `next.config.js`

- [ ] **Step 1: Replace `next.config.js` with the following**

```js
/** @type {import('next').NextConfig} */
const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.accounts.dev",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://img.clerk.com https://assets.coingecko.com https://static2.finnhub.io",
      "connect-src 'self' https://*.clerk.com https://*.clerk.accounts.dev https://*.upstash.io wss://*.clerk.accounts.dev",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]

const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: 'assets.coingecko.com' },
      { protocol: 'https', hostname: 'static2.finnhub.io' },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 2: Verify headers are applied**

```bash
npm run build 2>&1 | tail -5
```

Expected: build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add next.config.js
git commit -m "security: add HTTP security headers (CSP, HSTS, X-Frame-Options)"
```

---

## Task 3: Fix admin route in middleware

**Files:**
- Modify: `middleware.ts`

- [ ] **Step 1: Remove `/api/admin(.*)` from public routes**

Current `middleware.ts`:
```ts
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/cron(.*)',
  '/api/admin(.*)',   // ← remove this line
])
```

Replace the entire file with:

```ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/cron(.*)',
])

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    auth().protect()
  }
})

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

Expected: build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "security: remove /api/admin from public routes"
```

---

## Task 4: Create Redis singleton

**Files:**
- Create: `lib/redis.ts`

- [ ] **Step 1: Create `lib/redis.ts`**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/redis.ts
git commit -m "feat: add shared Upstash Redis singleton"
```

---

## Task 5: Create `lib/rate-limit.ts` with tests

**Files:**
- Create: `lib/rate-limit.ts`
- Create: `__tests__/lib/rate-limit.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/rate-limit.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @upstash/ratelimit before importing the module under test
vi.mock('@upstash/ratelimit', () => {
  const mockLimit = vi.fn()
  const Ratelimit = vi.fn().mockImplementation(() => ({ limit: mockLimit }))
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- __tests__/lib/rate-limit.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/rate-limit'`

- [ ] **Step 3: Create `lib/rate-limit.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/lib/rate-limit.test.ts
```

Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/rate-limit.ts __tests__/lib/rate-limit.test.ts
git commit -m "feat: add rate limit helper with tests"
```

---

## Task 6: Create `lib/cache.ts` with tests

**Files:**
- Create: `lib/cache.ts`
- Create: `__tests__/lib/cache.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/cache.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- __tests__/lib/cache.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/cache'`

- [ ] **Step 3: Create `lib/cache.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/lib/cache.test.ts
```

Expected: PASS — all 4 tests pass.

- [ ] **Step 5: Run all tests to confirm nothing broken**

```bash
npm test
```

Expected: all existing tests + new tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/cache.ts __tests__/lib/cache.test.ts
git commit -m "feat: add withCache helper with tests"
```

---

## Task 7: Apply rate limiting to trades and portfolio reset

**Files:**
- Modify: `app/api/trades/route.ts`
- Modify: `app/api/portfolio/reset/route.ts`

- [ ] **Step 1: Update `app/api/trades/route.ts`**

Replace the full file:

```ts
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { executeTrade } from '@/lib/trading-engine'
import { makeLimiter, checkRateLimit } from '@/lib/rate-limit'

const TradeSchema = z.object({
  symbol: z.string().min(1).max(20).toUpperCase(),
  assetType: z.enum(['STOCK', 'CRYPTO', 'COMMODITY']),
  side: z.enum(['BUY', 'SELL', 'SHORT', 'COVER']),
  quantity: z.number().positive(),
  note: z.string().max(500).optional(),
})

const limiter = makeLimiter(10, '1 m')

export async function POST(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(limiter, userId)
  if (rl && !rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = TradeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { account: true },
  })

  if (!user?.account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const result = await executeTrade({
    accountId: user.account.id,
    symbol: parsed.data.symbol,
    assetType: parsed.data.assetType,
    side: parsed.data.side,
    quantity: parsed.data.quantity,
    note: parsed.data.note,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json(result.trade, { status: 201 })
}
```

- [ ] **Step 2: Update `app/api/portfolio/reset/route.ts`**

Replace the full file:

```ts
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { makeLimiter, checkRateLimit } from '@/lib/rate-limit'

const limiter = makeLimiter(3, '1 h')

export async function POST() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(limiter, userId)
  if (rl && !rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
    )
  }

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { account: true },
  })

  if (!user?.account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })

  const startingBalance = Number(user.account.startingBalance)

  await db.$transaction([
    db.holding.deleteMany({ where: { accountId: user.account.id } }),
    db.trade.deleteMany({ where: { accountId: user.account.id } }),
    db.portfolioSnapshot.deleteMany({ where: { accountId: user.account.id } }),
    db.paperAccount.update({
      where: { id: user.account.id },
      data: { cashBalance: startingBalance },
    }),
  ])

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/trades/route.ts app/api/portfolio/reset/route.ts
git commit -m "feat: rate limit trades (10/min) and portfolio reset (3/hr)"
```

---

## Task 8: Apply rate limiting to market data routes

**Files:**
- Modify: `app/api/market/quote/route.ts`
- Modify: `app/api/market/history/route.ts`
- Modify: `app/api/market/overview/route.ts`
- Modify: `app/api/market/screener/route.ts`

- [ ] **Step 1: Update `app/api/market/quote/route.ts`**

Replace the full file:

```ts
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getQuote } from '@/lib/market-data'
import { makeLimiter, checkRateLimit } from '@/lib/rate-limit'
import type { AssetType } from '@/types'

const limiter = makeLimiter(30, '1 m')

export async function GET(req: Request) {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(limiter, userId)
  if (rl && !rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
    )
  }

  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')
  const assetType = searchParams.get('assetType') as AssetType | null

  if (!symbol) return NextResponse.json({ error: 'symbol is required' }, { status: 400 })

  try {
    const quote = await getQuote(symbol, assetType ?? undefined)
    return NextResponse.json(quote)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch quote'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
```

- [ ] **Step 2: Update `app/api/market/history/route.ts`**

Add rate limiting after the auth check. Replace the full file:

```ts
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getCandles } from '@/lib/market-data'
import { makeLimiter, checkRateLimit } from '@/lib/rate-limit'
import type { AssetType } from '@/types'
import type { CandleResolution } from '@/lib/market-data/types'

const limiter = makeLimiter(30, '1 m')

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(limiter, userId)
  if (rl && !rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
    )
  }

  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')
  const assetType = (searchParams.get('assetType') || 'STOCK') as AssetType
  const resolution = (searchParams.get('resolution') || 'D') as CandleResolution
  const range = searchParams.get('range') || '1M'

  if (!symbol) return NextResponse.json({ error: 'symbol is required' }, { status: 400 })

  const to = Math.floor(Date.now() / 1000)

  const rangeResolutionMap: Record<string, CandleResolution> = {
    '1D': '1',
    '1W': '60',
    '1M': '60',
    '3M': 'D',
    '1Y': 'D',
    '5Y': 'W',
  }
  const resolvedResolution: CandleResolution = rangeResolutionMap[range] ?? resolution

  const rangeMap: Record<string, number> = {
    '1D': 86400,
    '1W': 604800,
    '1M': 2592000,
    '3M': 7776000,
    '1Y': 31536000,
    '5Y': 157680000,
  }
  const from = to - (rangeMap[range] || rangeMap['1M'])

  try {
    const candles = await getCandles(symbol, assetType, resolvedResolution, from, to)
    return NextResponse.json(candles)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
```

- [ ] **Step 3: Update `app/api/market/overview/route.ts`**

Replace the full file:

```ts
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getIndices, getSectors, getTopMovers } from '@/lib/market-data/overview'
import { makeLimiter, checkRateLimit } from '@/lib/rate-limit'

const limiter = makeLimiter(30, '1 m')

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(limiter, userId)
  if (rl && !rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
    )
  }

  const [indicesResult, sectorsResult, moversResult] = await Promise.allSettled([
    getIndices(),
    getSectors(),
    getTopMovers(),
  ])

  return NextResponse.json(
    {
      indices: indicesResult.status === 'fulfilled' ? indicesResult.value : [],
      sectors: sectorsResult.status === 'fulfilled' ? sectorsResult.value : [],
      movers:  moversResult.status === 'fulfilled'  ? moversResult.value  : { gainers: [], losers: [] },
    },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } }
  )
}
```

- [ ] **Step 4: Update `app/api/market/screener/route.ts`**

The screener route currently has no auth check. Add auth + rate limiting. Replace the full file:

```ts
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { getStockQuote } from '@/lib/market-data/finnhub'
import { makeLimiter, checkRateLimit } from '@/lib/rate-limit'

const SCREENER_STOCKS: { symbol: string; sector: string }[] = [
  { symbol: 'AAPL', sector: 'Technology' },
  { symbol: 'MSFT', sector: 'Technology' },
  { symbol: 'NVDA', sector: 'Technology' },
  { symbol: 'GOOGL', sector: 'Technology' },
  { symbol: 'META', sector: 'Technology' },
  { symbol: 'AMD', sector: 'Technology' },
  { symbol: 'TSLA', sector: 'Technology' },
  { symbol: 'ORCL', sector: 'Technology' },
  { symbol: 'CRM', sector: 'Technology' },
  { symbol: 'ADBE', sector: 'Technology' },
  { symbol: 'JPM', sector: 'Finance' },
  { symbol: 'BAC', sector: 'Finance' },
  { symbol: 'GS', sector: 'Finance' },
  { symbol: 'V', sector: 'Finance' },
  { symbol: 'MA', sector: 'Finance' },
  { symbol: 'BLK', sector: 'Finance' },
  { symbol: 'JNJ', sector: 'Healthcare' },
  { symbol: 'LLY', sector: 'Healthcare' },
  { symbol: 'UNH', sector: 'Healthcare' },
  { symbol: 'ABBV', sector: 'Healthcare' },
  { symbol: 'PFE', sector: 'Healthcare' },
  { symbol: 'XOM', sector: 'Energy' },
  { symbol: 'CVX', sector: 'Energy' },
  { symbol: 'COP', sector: 'Energy' },
  { symbol: 'AMZN', sector: 'Consumer' },
  { symbol: 'WMT', sector: 'Consumer' },
  { symbol: 'COST', sector: 'Consumer' },
  { symbol: 'MCD', sector: 'Consumer' },
  { symbol: 'NKE', sector: 'Consumer' },
  { symbol: 'BA', sector: 'Industrials' },
  { symbol: 'CAT', sector: 'Industrials' },
  { symbol: 'GE', sector: 'Industrials' },
]

const limiter = makeLimiter(20, '1 m')

export async function GET() {
  const { userId } = auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(limiter, userId)
  if (rl && !rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
    )
  }

  const results = await Promise.allSettled(
    SCREENER_STOCKS.map(async ({ symbol, sector }) => {
      const quote = await getStockQuote(symbol)
      return { ...quote, sector }
    })
  )

  const stocks = results
    .filter((r): r is PromiseFulfilledResult<ReturnType<typeof getStockQuote> extends Promise<infer T> ? T & { sector: string } : never> => r.status === 'fulfilled')
    .map(r => r.value)

  return NextResponse.json(stocks)
}
```

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: build completes with no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/market/quote/route.ts app/api/market/history/route.ts app/api/market/overview/route.ts app/api/market/screener/route.ts
git commit -m "feat: rate limit market data routes (30/min) and add auth to screener"
```

---

## Task 9: Apply rate limiting to alerts

**Files:**
- Modify: `app/api/alerts/route.ts`

- [ ] **Step 1: Update `app/api/alerts/route.ts`**

Replace the full file:

```ts
export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db as prisma } from '@/lib/db'
import { makeLimiter, checkRateLimit } from '@/lib/rate-limit'

const AlertSchema = z.object({
  symbol: z.string().min(1).toUpperCase(),
  assetType: z.enum(['STOCK', 'CRYPTO', 'COMMODITY']),
  targetPrice: z.number().positive(),
  condition: z.enum(['ABOVE', 'BELOW']),
})

const limiter = makeLimiter(20, '1 h')

export async function GET() {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const alerts = await prisma.priceAlert.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(alerts)
}

export async function POST(req: Request) {
  const { userId: clerkId } = auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await checkRateLimit(limiter, clerkId)
  if (rl && !rl.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
    )
  }

  const user = await prisma.user.findUnique({ where: { clerkId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = AlertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const { symbol, assetType, targetPrice, condition } = parsed.data

  const alert = await prisma.priceAlert.create({
    data: {
      userId: user.id,
      symbol,
      assetType,
      targetPrice,
      condition,
    },
  })

  return NextResponse.json(alert, { status: 201 })
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/alerts/route.ts
git commit -m "feat: rate limit alert creation (20/hr per user)"
```

---

## Task 10: Apply Redis caching to market data

**Files:**
- Modify: `lib/market-data/index.ts`
- Modify: `lib/market-data/overview.ts`

- [ ] **Step 1: Replace `lib/market-data/index.ts` with the cached version**

```ts
import type { Quote, CandleData, SearchResult, TrendingAsset } from '@/types'
import type { CandleResolution } from './types'
import { getStockQuote, getStockCandles, searchStocks, getTrendingStocks } from './finnhub'
import { searchCrypto, getTrendingCrypto, getCryptoSymbols } from './coingecko'
import { getBinanceCryptoQuote, getBinanceCryptoCandles } from './binance'
import {
  getCommodityQuote,
  getCommodityCandles,
  getCommodityIntradayCandles,
  getTrendingCommodities,
  isCommoditySymbol,
  getStockCandlesYahoo,
} from './yahoo'
import { withCache } from '@/lib/cache'

export async function isCrypto(symbol: string): Promise<boolean> {
  const symbols = await getCryptoSymbols()
  return symbols.has(symbol.toUpperCase())
}

export async function getQuote(symbol: string, assetType?: 'STOCK' | 'CRYPTO' | 'COMMODITY'): Promise<Quote> {
  const key = `market:quote:${symbol.toUpperCase()}:${assetType ?? 'AUTO'}`
  return withCache(key, 60, async () => {
    if (assetType === 'COMMODITY' || isCommoditySymbol(symbol)) return getCommodityQuote(symbol)
    const type = assetType ?? ((await isCrypto(symbol)) ? 'CRYPTO' : 'STOCK')
    if (type === 'CRYPTO') return getBinanceCryptoQuote(symbol)
    return getStockQuote(symbol)
  })
}

export async function getCandles(
  symbol: string,
  assetType: 'STOCK' | 'CRYPTO' | 'COMMODITY',
  resolution: CandleResolution,
  from: number,
  to: number
): Promise<CandleData[]> {
  const key = `market:candles:${symbol.toUpperCase()}:${assetType}:${resolution}:${from}`
  return withCache(key, 300, async () => {
    if (assetType === 'COMMODITY') {
      if (resolution === '1') return getCommodityIntradayCandles(symbol)
      return getCommodityCandles(symbol, from, to)
    }
    if (assetType === 'CRYPTO') return getBinanceCryptoCandles(symbol, from, to)
    let candles: CandleData[] = []
    try {
      candles = await getStockCandles(symbol, resolution, from, to)
    } catch { /* Finnhub unavailable on free tier — fall through to Yahoo */ }
    if (candles.length > 0) return candles
    return getStockCandlesYahoo(symbol, from, to, resolution)
  })
}

export async function search(query: string): Promise<SearchResult[]> {
  const [stocks, crypto] = await Promise.allSettled([searchStocks(query), searchCrypto(query)])
  const results: SearchResult[] = []
  if (stocks.status === 'fulfilled') results.push(...stocks.value)
  if (crypto.status === 'fulfilled') results.push(...crypto.value)
  return results.slice(0, 20)
}

export async function getTrending(): Promise<{ stocks: TrendingAsset[]; crypto: TrendingAsset[]; commodities: TrendingAsset[] }> {
  const [stocks, crypto, commodities] = await Promise.allSettled([
    getTrendingStocks(),
    getTrendingCrypto(),
    getTrendingCommodities(),
  ])
  return {
    stocks: stocks.status === 'fulfilled' ? stocks.value : [],
    crypto: crypto.status === 'fulfilled' ? crypto.value : [],
    commodities: commodities.status === 'fulfilled' ? commodities.value : [],
  }
}
```

- [ ] **Step 2: Replace `lib/market-data/overview.ts` with the cached version**

```ts
import YahooFinance from 'yahoo-finance2'
import { UNIVERSE } from '@/lib/bot/universe'
import { withCache } from '@/lib/cache'

const yf = new YahooFinance()

const INDEX_LIST = [
  { label: 'S&P 500', ticker: '^GSPC' },
  { label: 'Nasdaq',  ticker: '^IXIC' },
  { label: 'Dow',     ticker: '^DJI'  },
  { label: 'Russell', ticker: '^RUT'  },
]

const SECTOR_LIST = [
  { name: 'Technology',       ticker: 'XLK'  },
  { name: 'Financials',       ticker: 'XLF'  },
  { name: 'Energy',           ticker: 'XLE'  },
  { name: 'Health Care',      ticker: 'XLV'  },
  { name: 'Industrials',      ticker: 'XLI'  },
  { name: 'Cons. Staples',    ticker: 'XLP'  },
  { name: 'Cons. Disc.',      ticker: 'XLY'  },
  { name: 'Real Estate',      ticker: 'XLRE' },
  { name: 'Materials',        ticker: 'XLB'  },
  { name: 'Utilities',        ticker: 'XLU'  },
  { name: 'Comm. Services',   ticker: 'XLC'  },
]

export interface IndexData {
  label: string
  ticker: string
  price: number
  change: number
  changePercent: number
}

export interface SectorData {
  name: string
  ticker: string
  changePercent: number
}

export interface MoverData {
  symbol: string
  price: number
  changePercent: number
}

export interface OverviewData {
  indices: IndexData[]
  sectors: SectorData[]
  movers: { gainers: MoverData[]; losers: MoverData[] }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchQuote(ticker: string): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (yf as any).quote(ticker, {}, { validateResult: false })
}

export function sectorColor(changePercent: number): string {
  if (changePercent > 2)     return 'bg-green text-white'
  if (changePercent >= 0.5)  return 'bg-green/20 text-green'
  if (changePercent >= -0.5) return 'bg-surface-2 text-text-muted'
  if (changePercent > -2)    return 'bg-red/20 text-red'
  return 'bg-red text-white'
}

export function pickMovers(
  movers: MoverData[],
  n: number
): { gainers: MoverData[]; losers: MoverData[] } {
  const sorted = [...movers].sort((a, b) => b.changePercent - a.changePercent)
  return {
    gainers: sorted.slice(0, n),
    losers: sorted.slice(Math.max(n, sorted.length - n)).reverse(),
  }
}

export async function getIndices(): Promise<IndexData[]> {
  return withCache('market:indices', 300, async () => {
    const results = await Promise.allSettled(INDEX_LIST.map(({ ticker }) => fetchQuote(ticker)))
    return results.map((r, i) => ({
      label: INDEX_LIST[i].label,
      ticker: INDEX_LIST[i].ticker,
      price: r.status === 'fulfilled' ? (r.value?.regularMarketPrice ?? 0) : 0,
      change: r.status === 'fulfilled' ? (r.value?.regularMarketChange ?? 0) : 0,
      changePercent: r.status === 'fulfilled' ? (r.value?.regularMarketChangePercent ?? 0) : 0,
    }))
  })
}

export async function getSectors(): Promise<SectorData[]> {
  return withCache('market:sectors', 300, async () => {
    const results = await Promise.allSettled(SECTOR_LIST.map(({ ticker }) => fetchQuote(ticker)))
    return results.map((r, i) => ({
      name: SECTOR_LIST[i].name,
      ticker: SECTOR_LIST[i].ticker,
      changePercent: r.status === 'fulfilled' ? (r.value?.regularMarketChangePercent ?? 0) : 0,
    }))
  })
}

export async function getTopMovers(): Promise<{ gainers: MoverData[]; losers: MoverData[] }> {
  return withCache('market:movers', 300, async () => {
    const stockSymbols = UNIVERSE.filter(a => a.assetType === 'STOCK').map(a => a.symbol)
    const results = await Promise.allSettled(stockSymbols.map(s => fetchQuote(s)))

    const movers: MoverData[] = results
      .map((r, i) => ({
        symbol: stockSymbols[i],
        price: r.status === 'fulfilled' ? (r.value?.regularMarketPrice ?? 0) : 0,
        changePercent: r.status === 'fulfilled' ? (r.value?.regularMarketChangePercent ?? 0) : 0,
      }))
      .filter(m => m.price > 0)

    return pickMovers(movers, 3)
  })
}

- [ ] **Step 3: Verify build and tests**

```bash
npm run build 2>&1 | tail -5 && npm test
```

Expected: build passes, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/market-data/index.ts lib/market-data/overview.ts
git commit -m "feat: cache market quotes (60s) and candles/overview (5min) in Redis"
```

---

## Task 11: Remove per-trade snapshot

**Files:**
- Modify: `lib/trading-engine.ts`

- [ ] **Step 1: Remove `saveSnapshot` call and function from `lib/trading-engine.ts`**

In `lib/trading-engine.ts`, make two changes:

1. Remove the `await saveSnapshot(tx, accountId)` call at line ~241 (inside `db.$transaction`, just before the `return` of the successful trade).

2. Delete the entire `saveSnapshot` function (lines ~257–281):
```ts
async function saveSnapshot(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  accountId: string
) {
  // ... entire function body
}
```

The result is that `executeTrade` no longer writes a snapshot row. The cron job at `app/api/cron/snapshots/route.ts` continues to handle periodic snapshots.

- [ ] **Step 2: Verify build and tests**

```bash
npm run build 2>&1 | tail -5 && npm test
```

Expected: build passes, all tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/trading-engine.ts
git commit -m "perf: remove per-trade portfolio snapshot — cron handles this"
```

---

## Task 12: Final verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: build completes cleanly.

- [ ] **Step 3: Verify all 6 spec items are covered**

Check:
- [ ] Security headers present in `next.config.js`
- [ ] `/api/admin(.*)` removed from public routes in `middleware.ts`
- [ ] `lib/rate-limit.ts` exists and is applied to trades, reset, market routes, alerts
- [ ] `lib/cache.ts` exists and is applied to `getQuote`, `getCandles`, overview functions
- [ ] `directUrl` added to `prisma/schema.prisma`
- [ ] `saveSnapshot` removed from `lib/trading-engine.ts`
