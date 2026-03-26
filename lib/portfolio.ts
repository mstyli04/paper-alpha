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

type LeaderboardResult = { userId: string; username: string; avatarUrl?: string; totalValue: number; startingBalance: number; returnPercent: number; totalPnl: number; dailyPnl?: number; dailyReturnPercent?: number; rank: number; isBot?: boolean }[]

export async function getLeaderboard(): Promise<LeaderboardResult> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const accounts = await db.paperAccount.findMany({
    include: {
      user: true,
      holdings: true,
      snapshots: {
        where: { createdAt: { lte: oneDayAgo } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  // Deduplicate symbols across all users so each symbol is fetched only once
  const uniqueSymbols = new Map<string, { symbol: string; assetType: AssetType }>()
  for (const account of accounts) {
    for (const h of account.holdings) {
      uniqueSymbols.set(h.symbol, { symbol: h.symbol, assetType: h.assetType as AssetType })
    }
  }

  // Fetch fresh prices; fall back to avgCostBasis if a fetch fails
  const priceMap = new Map<string, number>()
  await Promise.allSettled(
    Array.from(uniqueSymbols.values()).map(async ({ symbol, assetType }) => {
      const quote = await getQuote(symbol, assetType)
      if (quote?.price) priceMap.set(symbol, quote.price)
    })
  )

  const data = accounts
    .map(account => {
      const startingBalance = Number(account.startingBalance)
      const cashBalance = Number(account.cashBalance)
      const holdingsValue = account.holdings.reduce((sum, h) => {
        const qty = Number(h.quantity)
        const price = priceMap.get(h.symbol) ?? Number(h.avgCostBasis)
        return sum + qty * price
      }, 0)
      const totalValue = cashBalance + holdingsValue
      const totalPnl = totalValue - startingBalance
      const returnPercent = startingBalance > 0 ? (totalPnl / startingBalance) * 100 : 0

      const snapshot24h = account.snapshots[0]
      const value24hAgo = snapshot24h ? Number(snapshot24h.totalValue) : undefined
      const dailyPnl = value24hAgo !== undefined ? totalValue - value24hAgo : undefined
      const dailyReturnPercent = value24hAgo && value24hAgo > 0 ? (dailyPnl! / value24hAgo) * 100 : undefined

      return {
        userId: account.userId,
        username: account.user.username,
        avatarUrl: account.user.avatarUrl ?? undefined,
        totalValue,
        startingBalance,
        returnPercent,
        totalPnl,
        dailyPnl,
        dailyReturnPercent,
        isBot: account.isBot,
      }
    })
    .sort((a, b) => b.returnPercent - a.returnPercent)
    .map((entry, i) => ({ ...entry, rank: i + 1 }))

  return data
}
