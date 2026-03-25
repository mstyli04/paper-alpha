import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { executeTrade } from '@/lib/trading-engine'
import { getCryptoQuote } from '@/lib/market-data/coingecko'

export const dynamic = 'force-dynamic'

const BOT_CLERK_ID = 'bot_alpha_momentum'

// Coins the bot rotates between
const TRACKED_COINS = ['BTC', 'ETH', 'SOL', 'AVAX', 'LINK', 'DOT', 'ADA', 'DOGE', 'UNI', 'ATOM']

const MAX_POSITIONS = 5        // hold at most 5 coins at once
const POSITION_SIZE_PCT = 0.20 // spend 20% of total portfolio per new position
const STOP_LOSS_PCT = -8       // cut losses at -8% from cost basis
const TAKE_PROFIT_PCT = 20     // take profits at +20% from cost basis

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const authHeader = req.headers.get('authorization') ?? ''
  const expected = `Bearer ${secret}`
  try {
    if (
      authHeader.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Load bot account
  const user = await db.user.findUnique({
    where: { clerkId: BOT_CLERK_ID },
    include: { account: { include: { holdings: true } } },
  })
  if (!user?.account) return NextResponse.json({ error: 'Bot not initialised. POST /api/admin/init-bot first.' }, { status: 404 })

  const accountId = user.account.id
  const log: string[] = []

  // Fetch live prices + 24h change for all tracked coins in parallel
  const quoteResults = await Promise.allSettled(
    TRACKED_COINS.map(async (symbol) => {
      const quote = await getCryptoQuote(symbol)
      return { symbol, price: quote.price, changePercent: quote.changePercent ?? 0 }
    })
  )

  const priceMap: Record<string, { price: number; changePercent: number }> = {}
  for (const r of quoteResults) {
    if (r.status === 'fulfilled' && r.value.price) {
      priceMap[r.value.symbol] = { price: r.value.price, changePercent: r.value.changePercent }
    }
  }

  // ── Phase 1: Review holdings — sell on stop-loss or take-profit ────────────
  const cryptoHoldings = user.account.holdings.filter(
    (h) => h.assetType === 'CRYPTO' && Number(h.quantity) > 0
  )

  for (const holding of cryptoHoldings) {
    const q = priceMap[holding.symbol]
    if (!q) continue

    const avgCost = Number(holding.avgCostBasis)
    const pnlPct = ((q.price - avgCost) / avgCost) * 100

    if (pnlPct <= STOP_LOSS_PCT || pnlPct >= TAKE_PROFIT_PCT) {
      const reason = pnlPct <= STOP_LOSS_PCT ? 'stop-loss' : 'take-profit'
      const result = await executeTrade({
        accountId,
        symbol: holding.symbol,
        assetType: 'CRYPTO',
        side: 'SELL',
        quantity: Number(holding.quantity),
        note: `AlphaBot ${reason} at ${pnlPct.toFixed(1)}%`,
      })
      if (result.success) {
        log.push(`SELL ${holding.symbol} (${reason} ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`)
      }
    }
  }

  // ── Phase 2: Buy top momentum coins to fill open slots ────────────────────
  const freshAccount = await db.paperAccount.findUnique({
    where: { id: accountId },
    include: { holdings: true },
  })
  if (!freshAccount) return NextResponse.json({ error: 'Account error' }, { status: 500 })

  const heldSymbols = new Set(
    freshAccount.holdings
      .filter((h) => h.assetType === 'CRYPTO' && Number(h.quantity) > 0)
      .map((h) => h.symbol)
  )

  const openSlots = MAX_POSITIONS - heldSymbols.size
  const cashBalance = Number(freshAccount.cashBalance)

  if (openSlots > 0 && cashBalance > 500) {
    // Estimate total portfolio value for position sizing
    const holdingsValue = freshAccount.holdings
      .filter((h) => h.assetType === 'CRYPTO' && priceMap[h.symbol])
      .reduce((sum, h) => sum + Number(h.quantity) * priceMap[h.symbol].price, 0)
    const totalPortfolio = cashBalance + holdingsValue

    // Sort unowned coins by 24h momentum (best performers first)
    const candidates = TRACKED_COINS.filter((s) => !heldSymbols.has(s) && priceMap[s]).sort(
      (a, b) => priceMap[b].changePercent - priceMap[a].changePercent
    )

    let slotsLeft = openSlots
    let remainingCash = cashBalance

    for (const symbol of candidates) {
      if (slotsLeft <= 0 || remainingCash < 500) break

      const price = priceMap[symbol].price
      const targetSpend = Math.min(totalPortfolio * POSITION_SIZE_PCT, remainingCash * 0.95)
      if (targetSpend < 100) break

      // Small buffer on quantity to avoid insufficient-funds edge cases
      const quantity = (targetSpend * 0.99) / price

      const result = await executeTrade({
        accountId,
        symbol,
        assetType: 'CRYPTO',
        side: 'BUY',
        quantity,
        note: `AlphaBot momentum buy (24h: ${priceMap[symbol].changePercent >= 0 ? '+' : ''}${priceMap[symbol].changePercent.toFixed(2)}%)`,
      })

      if (result.success && result.trade) {
        log.push(
          `BUY ${symbol} x${quantity.toFixed(4)} @ $${price.toLocaleString()} (24h: ${priceMap[symbol].changePercent >= 0 ? '+' : ''}${priceMap[symbol].changePercent.toFixed(2)}%)`
        )
        remainingCash -= result.trade.totalValue
        slotsLeft--
      }
    }
  }

  return NextResponse.json({ ok: true, actions: log, timestamp: new Date().toISOString() })
}
