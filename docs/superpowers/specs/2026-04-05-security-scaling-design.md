# Security & Scaling Hardening — paper-alpha

**Date:** 2026-04-05  
**Approach:** B — Security fixes + Upstash Redis (rate limiting + caching) + DB connection pooling

---

## 1. Security Headers

Add HTTP security headers to all responses via `next.config.js` `headers()`.

Headers to add:
- `Content-Security-Policy` — restrict script/style/frame sources to same-origin and trusted CDNs (Clerk, fonts)
- `X-Frame-Options: DENY` — prevent clickjacking
- `X-Content-Type-Options: nosniff` — stop MIME-type sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` — limit referrer leakage
- `Strict-Transport-Security: max-age=63072000; includeSubDomains` — force HTTPS
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — disable unused browser APIs

**Files changed:** `next.config.js`

---

## 2. Fix Admin Route Auth

**Problem:** `middleware.ts` lists `/api/admin(.*)` as a public route (line 9). Any request bypasses Clerk auth; the only protection is the runtime `CRON_SECRET` check inside the route handler. If a future admin route omits that check, it is wide open.

**Fix:** Remove `/api/admin(.*)` from the `isPublicRoute` matcher. The existing `CRON_SECRET` timing-safe check in `app/api/admin/init-bot/route.ts` already provides the correct protection when the header is supplied — removing the public route exception does not break this.

Cron routes (`/api/cron(.*)`) remain public — Vercel must call them unauthenticated.

**Files changed:** `middleware.ts`

---

## 3. Rate Limiting

**Dependencies:** `@upstash/ratelimit`, `@upstash/redis`

**New env vars:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

Create `lib/rate-limit.ts` — a shared helper that initialises the Redis client and exports a `checkRateLimit(userId, limiter)` function returning `{ success, limit, remaining, reset }`.

Apply rate limits:

| Route | Limit | Window | Key |
|---|---|---|---|
| `POST /api/trades` | 10 requests | 1 minute | `userId` |
| `POST /api/portfolio/reset` | 3 requests | 1 hour | `userId` |
| `GET /api/market/quote` | 30 requests | 1 minute | `userId` |
| `GET /api/market/history` | 30 requests | 1 minute | `userId` |
| `GET /api/market/overview` | 30 requests | 1 minute | `userId` |
| `GET /api/market/screener` | 20 requests | 1 minute | `userId` |
| `POST /api/alerts` | 20 requests | 1 hour | `userId` |

Rate limit key is Clerk `userId` throughout — per-user, not per-IP, so it cannot be bypassed by rotating IP addresses. The four market routes above are the most expensive in terms of external API calls; the remaining market routes (news, trending, etc.) are protected indirectly by caching (Section 4).

On limit exceeded, return `429 Too Many Requests` with a `Retry-After` header.

**Files changed:** `lib/rate-limit.ts` (new), `app/api/trades/route.ts`, `app/api/portfolio/reset/route.ts`, `app/api/market/quote/route.ts`, `app/api/market/history/route.ts`, `app/api/market/overview/route.ts`, `app/api/market/screener/route.ts`, `app/api/alerts/route.ts`

---

## 4. Market Data Caching

**Dependencies:** `@upstash/redis` (same client as rate limiting)

Create `lib/cache.ts` — a thin wrapper around the Redis client with a `withCache<T>(key, ttlSeconds, fn)` helper. If the key exists in Redis, return it. Otherwise call `fn()`, store the result, and return it.

Apply caching in `lib/market-data/`:

| Data type | TTL | Rationale |
|---|---|---|
| Stock/crypto quotes | 60s | Paper trading doesn't require real-time prices |
| Market overview / trending | 5 min | Aggregated data, changes slowly |
| News | 10 min | Articles don't update frequently |
| Screener results | 5 min | Broad market scans are expensive |
| Historical candles | 5 min | Used for charts, acceptable staleness |

Cache keys are namespaced: `market:quote:AAPL`, `market:overview`, etc.

**Files changed:** `lib/cache.ts` (new), `lib/market-data/index.ts` and relevant provider files

---

## 5. DB Connection Pooling

**Problem:** Vercel deploys each API route as an isolated serverless function. Without pooling, each cold-start opens a new Postgres connection. Under moderate traffic this exhausts the DB's `max_connections` limit.

**Fix:** Append connection pooling parameters to `DATABASE_URL`:

```
?pgbouncer=true&connection_limit=1
```

This tells Prisma to use PgBouncer-compatible mode and limit each function instance to one connection. Compatible with Neon, Supabase, and any PgBouncer setup. No application code changes required.

Add `DIRECT_URL` (unpooled) for Prisma migrations in `schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")       // pooled — used at runtime
  directUrl = env("DIRECT_URL")         // unpooled — used for migrations
}
```

**Files changed:** `.env.example`, `prisma/schema.prisma`

---

## 6. Remove Per-Trade Snapshot

**Problem:** `executeTrade()` in `lib/trading-engine.ts` calls `saveSnapshot()` on every trade, writing a `PortfolioSnapshot` row to the DB on every buy/sell/short/cover. This is unnecessary — snapshots are used for portfolio history charts and the existing cron job (`/api/cron/snapshots`) already handles periodic snapshot creation.

**Fix:** Remove the `saveSnapshot(tx, accountId)` call and the `saveSnapshot` function from `lib/trading-engine.ts`. The cron job continues to create snapshots on its existing schedule. No data is lost — all trade data remains in the `Trade` table.

**Files changed:** `lib/trading-engine.ts`

---

## Dependencies to Install

```bash
npm install @upstash/ratelimit @upstash/redis
```

## New Environment Variables

```env
# Upstash Redis (free tier at upstash.com)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Prisma direct connection (for migrations)
DIRECT_URL=postgresql://user:password@host:5432/paper_alpha?sslmode=require
```

---

## Out of Scope

- Input validation on all 37+ routes (only high-risk routes are rate-limited; full Zod coverage is a separate task)
- Sentry / structured logging
- CDN configuration (Vercel handles this automatically)
- Real-time WebSocket data
