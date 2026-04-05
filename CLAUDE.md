# paper-alpha

Paper trading platform (stocks + crypto) with leaderboards, alerts, and AI analysis.

## Stack
- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Auth:** Clerk (`middleware.ts` protects all non-public routes)
- **DB:** PostgreSQL via Prisma (`lib/db.ts`)
- **Market data:** `lib/market-data/` — Yahoo Finance, Binance, CoinGecko, Finnhub, LiveCoinWatch
- **Charts:** lightweight-charts
- **Testing:** Vitest
- **Deploy:** Vercel

## Commands
```bash
npm run dev          # Dev server
npm run build        # prisma generate + next build
npm run test         # Vitest (run once)
npm run test:watch   # Vitest (watch)
npm run db:push      # Push schema to DB (no migration)
npm run db:migrate   # Create + run migration
npm run db:studio    # Prisma Studio
npm run db:seed      # Seed database
```

## Key Files
- `lib/db.ts` — Prisma client singleton
- `lib/trading-engine.ts` — Core buy/sell logic
- `lib/market-data/index.ts` — Market data entry point
- `middleware.ts` — Clerk auth (public routes: `/`, `/sign-in`, `/sign-up`, `/api/webhooks`, `/api/cron`)
- `prisma/schema.prisma` — DB schema

## Architecture
```
app/
├── (auth)/          # Sign in/up pages
├── (dashboard)/     # Protected app routes
│   ├── portfolio/   # Holdings + P&L
│   ├── markets/     # Market browser
│   ├── analysis/    # AI analysis (Anthropic SDK)
│   ├── leaderboard/ # Rankings
│   ├── screener/    # Asset screener
│   ├── alerts/      # Price alerts
│   ├── history/     # Trade history
│   └── profile/     # User profiles
└── api/             # API routes (trades, portfolio, market, cron, webhooks)
```

## Data Model
- `User` → `PaperAccount` (1:1) → `Holdings`, `Trades`, `PortfolioSnapshot`, `StopOrder`
- `Decimal(20,8)` used throughout for financial precision
- `AssetType` enum distinguishes stocks vs crypto

## Gotchas
- Always run `prisma generate` before `next build` (handled by build script)
- Clerk webhook routes (`/api/webhooks`) must stay public in middleware
- Use `Decimal.js` for all financial calculations — never native floats
- Cron routes (`/api/cron`) are public — Vercel calls them unauthenticated
