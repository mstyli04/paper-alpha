import { db } from './db'
import { getQuote } from './market-data'
import type { Portfolio, Holding, AssetType } from '@/types'

export async function getPortfolio(accountId: string): Promise<Portfolio> {
  const account = await db.paperAccount.findUnique({
    where: { id: accountId },
    include: { holdings: true },
  })

  if (!account) throw new Error('Account not found')

  const cashBalance = Number(account.cashBalance)
  const startingBalance = Number(account.startingBalance)

  const priceResults = await Promise.allSettled(
    account.holdings.map(h => getQuote(h.symbol, h.assetType as AssetType))
  )

  const holdings: Holding[] = account.holdings.map((h, i) => {
    const priceResult = priceResults[i]
    const currentPrice = priceResult.status === 'fulfilled' ? priceResult.value.price : Number(h.avgCostBasis)
    const quantity = Number(h.quantity)
    const avgCostBasis = Number(h.avgCostBasis)
    const isShort = quantity < 0
    const absQty = Math.abs(quantity)

    // For shorts: value = -(current price * qty) — it's a liability
    // For longs: value = current price * qty
    const currentValue = isShort
      ? -(currentPrice * absQty)
      : currentPrice * quantity

    // For shorts: profit when price falls below short entry
    const unrealizedPnl = isShort
      ? (avgCostBasis - currentPrice) * absQty
      : (currentPrice - avgCostBasis) * quantity

    const unrealizedPnlPercent = avgCostBasis > 0
      ? (unrealizedPnl / (avgCostBasis * absQty)) * 100
      : 0

    return {
      id: h.id,
      symbol: h.symbol,
      assetType: h.assetType as AssetType,
      quantity,
      avgCostBasis,
      realizedPnl: Number(h.realizedPnl),
      currentPrice,
      currentValue,
      unrealizedPnl,
      unrealizedPnlPercent,
    }
  })

  const holdingsValue = holdings.reduce((sum, h) => sum + (h.currentValue ?? 0), 0)
  const totalValue = cashBalance + holdingsValue
  const totalInvested = holdings
    .filter(h => h.quantity > 0)
    .reduce((sum, h) => sum + h.avgCostBasis * h.quantity, 0)
  const unrealizedPnl = holdings.reduce((sum, h) => sum + (h.unrealizedPnl ?? 0), 0)
  const realizedPnl = holdings.reduce((sum, h) => sum + h.realizedPnl, 0)
  const totalPnl = totalValue - startingBalance
  const totalPnlPercent = startingBalance > 0 ? (totalPnl / startingBalance) * 100 : 0

  return {
    cashBalance,
    startingBalance,
    holdings,
    totalValue,
    totalInvested,
    unrealizedPnl,
    realizedPnl,
    totalPnl,
    totalPnlPercent,
  }
}

// ── Leaderboard price cache ───────────────────────────────────────────────────
// Persists last-known prices across leaderboard calls within a warm instance.
// This prevents the "net 0" bug: when a live fetch fails the fallback is a
// real price rather than cost-basis (which mathematically cancels to 0 P&L).
const lastKnownPrices = new Map<string, number>()

// Cache the full computed leaderboard for 90 s so repeat page loads are instant.
type LeaderboardResult = { userId: string; username: string; avatarUrl?: string; totalValue: number; startingBalance: number; returnPercent: number; totalPnl: number; rank: number; isBot?: boolean }[]
let leaderboardCache: { data: LeaderboardResult; at: number } | null = null
const LEADERBOARD_TTL = 90_000

export async function getLeaderboard(): Promise<LeaderboardResult> {
  if (leaderboardCache && Date.now() - leaderboardCache.at < LEADERBOARD_TTL) {
    return leaderboardCache.data
  }

  const accounts = await db.paperAccount.findMany({
    include: {
      user: true,
      holdings: true,
    },
  })

  // Deduplicate symbols across all users so each symbol is fetched only once
  const uniqueSymbols = new Map<string, { symbol: string; assetType: AssetType }>()
  for (const account of accounts) {
    for (const h of account.holdings) {
      uniqueSymbols.set(h.symbol, { symbol: h.symbol, assetType: h.assetType as AssetType })
    }
  }

  // Fetch fresh prices; on success update the persistent price cache
  await Promise.allSettled(
    Array.from(uniqueSymbols.values()).map(async ({ symbol, assetType }) => {
      try {
        const quote = await getQuote(symbol, assetType)
        if (quote?.price) lastKnownPrices.set(symbol, quote.price)
      } catch {
        // lastKnownPrices retains the previous value — used as fallback below
      }
    })
  )

  const data = accounts
    .map(account => {
      const startingBalance = Number(account.startingBalance)
      const cashBalance = Number(account.cashBalance)
      const holdingsValue = account.holdings.reduce((sum, h) => {
        const qty = Number(h.quantity)
        // Prefer last-known price over cost basis: cost basis always cancels
        // to 0 P&L (cash spent + qty×costBasis = startingBalance exactly).
        const price = lastKnownPrices.get(h.symbol) ?? Number(h.avgCostBasis)
        return sum + qty * price
      }, 0)
      const totalValue = cashBalance + holdingsValue
      const totalPnl = totalValue - startingBalance
      const returnPercent = startingBalance > 0 ? (totalPnl / startingBalance) * 100 : 0

      return {
        userId: account.userId,
        username: account.user.username,
        avatarUrl: account.user.avatarUrl ?? undefined,
        totalValue,
        startingBalance,
        returnPercent,
        totalPnl,
        isBot: account.isBot,
      }
    })
    .sort((a, b) => b.returnPercent - a.returnPercent)
    .map((entry, i) => ({ ...entry, rank: i + 1 }))

  leaderboardCache = { data, at: Date.now() }
  return data
}
