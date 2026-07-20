import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { checkRateLimit, resolveRateLimitTier } from '@/lib/rate-limit'

const isPublicRoute = createRouteMatcher([
  '/',
  '/privacy',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/cron(.*)',
  '/api/admin(.*)',
])

// Random per-request nonce so script-src doesn't need 'unsafe-inline' — the
// only inline script in the app is next-themes' pre-hydration theme-flash
// script (see components/layout/theme-provider.tsx), which reads this nonce
// via its `nonce` prop. Clerk's and Cloudflare's scripts load from allowed
// hosts, not inline, so they don't need it.
function generateNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

function buildCsp(nonce: string): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    'https://*.clerk.accounts.dev',
    'https://challenges.cloudflare.com',
    // 'unsafe-eval' is a dev-only requirement (webpack eval-source-map);
    // production bundles don't need it.
    ...(process.env.NODE_ENV !== 'production' ? ["'unsafe-eval'"] : []),
  ].join(' ')

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https://img.clerk.com https://assets.coingecko.com https://coin-images.coingecko.com https://static2.finnhub.io",
    "font-src 'self' data: https://fonts.gstatic.com",
    "connect-src 'self' https://*.clerk.accounts.dev https://clerk-telemetry.com",
    "frame-src 'self' https://*.clerk.accounts.dev https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }

  // API rate limiting — scoped to /api/* only so page navigations never hit
  // Redis. cron/admin/webhooks are excluded (see resolveRateLimitTier).
  const tier = resolveRateLimitTier(req.nextUrl.pathname, req.method)
  if (tier) {
    const { userId } = await auth()
    const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const identity = userId ?? forwardedFor ?? 'anonymous'

    const { success, limit, remaining, reset } = await checkRateLimit(tier, identity)
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'Retry-After': Math.max(0, Math.ceil((reset - Date.now()) / 1000)).toString(),
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
          },
        }
      )
    }
  }

  const nonce = generateNonce()
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', buildCsp(nonce))
  return response
})

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
}
