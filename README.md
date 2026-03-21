# Paper Alpha

A full-stack paper trading platform where users trade stocks and crypto with $100,000 in virtual cash using real-time market prices, track their P&L, and compete on leaderboards.

## Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: Clerk
- **Charts**: lightweight-charts (TradingView OSS)
- **Market Data**: Finnhub (stocks) + CoinGecko (crypto)
- **Deployment**: Vercel + Neon (serverless Postgres)

---

## Quick Start

### 1. Clone and install

```bash
git clone <your-repo>
cd paper-alpha
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | [Neon](https://neon.tech) — create a free project, copy the connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | [Clerk Dashboard](https://clerk.com) → API Keys |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys |
| `CLERK_WEBHOOK_SECRET` | See step 4 below |
| `FINNHUB_API_KEY` | [Finnhub](https://finnhub.io) → free account → API Key |
| `COINGECKO_API_KEY` | Optional — leave blank for free tier |

### 3. Set up the database

```bash
npm run db:push
```

This applies the Prisma schema to your database. For production, use `npm run db:migrate` instead.

### 4. Set up Clerk webhook

Clerk webhooks auto-create users in your database when someone signs up.

1. Go to **Clerk Dashboard → Webhooks → Add Endpoint**
2. Set the URL to: `https://your-domain.com/api/webhooks/clerk`
   - For local dev, use [ngrok](https://ngrok.com): `ngrok http 3000`
3. Subscribe to events: `user.created`, `user.updated`
4. Copy the **Signing Secret** → paste into `CLERK_WEBHOOK_SECRET`

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Project Structure

```
paper-alpha/
├── app/
│   ├── (auth)/                    # Sign-in / sign-up pages
│   ├── (dashboard)/               # All authenticated pages
│   │   ├── dashboard/             # Main dashboard
│   │   ├── markets/               # Market browser + asset detail
│   │   ├── portfolio/             # Portfolio overview
│   │   ├── leaderboard/           # Rankings
│   │   ├── history/               # Trade history
│   │   └── settings/              # User settings
│   ├── api/                       # API routes
│   │   ├── user/                  # User management
│   │   ├── market/                # Quote, search, trending, history
│   │   ├── trades/                # Execute trades
│   │   ├── portfolio/             # Portfolio data + snapshots + reset
│   │   ├── leaderboard/           # Rankings
│   │   ├── watchlist/             # Watchlist management
│   │   ├── history/               # Trade history
│   │   └── webhooks/clerk/        # Clerk user sync
│   ├── layout.tsx
│   └── page.tsx                   # Landing page
├── components/
│   ├── charts/                    # PriceChart, PortfolioChart
│   ├── layout/                    # Sidebar, Header
│   ├── markets/                   # AssetRow
│   ├── portfolio/                 # HoldingsTable, StatsCard
│   ├── trading/                   # OrderForm
│   └── ui/                        # Badge, Skeleton
├── hooks/                         # use-portfolio, use-quote, use-search
├── lib/
│   ├── market-data/               # Finnhub + CoinGecko adapters
│   ├── db.ts                      # Prisma client singleton
│   ├── trading-engine.ts          # Order execution + P&L logic
│   ├── portfolio.ts               # Portfolio calculations
│   └── utils.ts                   # Formatting helpers
├── prisma/
│   └── schema.prisma              # Database schema
└── types/
    └── index.ts                   # Shared TypeScript types
```

---

## Deployment

### Vercel + Neon

1. Push to GitHub
2. Import repo in [Vercel](https://vercel.com)
3. Add all environment variables in Vercel dashboard
4. Deploy

For the database, [Neon](https://neon.tech) provides a free serverless PostgreSQL instance that works great with Vercel. After creating your Neon project, run migrations:

```bash
DATABASE_URL="your-neon-url" npm run db:migrate
```

### Update Clerk webhook URL

After deploying, update your Clerk webhook URL from the ngrok address to your real Vercel URL.

---

## Key Business Logic

### Trading Engine (`lib/trading-engine.ts`)

- **Buy**: validates cash balance → updates holding with weighted average cost basis → deducts cash → records trade → saves portfolio snapshot
- **Sell**: validates holding quantity → calculates realized P&L → adds proceeds to cash → updates/removes holding → records trade → saves snapshot

### P&L Calculation

- **Unrealized P&L**: `(currentPrice - avgCostBasis) × quantity`
- **Realized P&L**: `(salePrice - avgCostBasis) × quantitySold`
- **Total Return**: `(totalPortfolioValue - startingBalance) / startingBalance × 100`

### Market Data

Data providers are abstracted behind `lib/market-data/index.ts`. To swap providers, implement the interface in `lib/market-data/types.ts` and update the index.

- **Stocks**: Finnhub free tier — 60 req/min, real-time quotes
- **Crypto**: CoinGecko free tier — ~30 req/min, no API key required

---

## Disclaimer

Paper Alpha is a simulated trading platform for educational purposes only. All trades use virtual currency. No real money is involved. Market data may be delayed. Nothing on this platform constitutes financial advice.
