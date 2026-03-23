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

export async function getLeaderboard() {
  // Use the most recent snapshot per account instead of fetching live prices for every holding.
  // This reduces N×M external API calls to a single database query.
  const accounts = await db.paperAccount.findMany({
    include: {
      user: true,
      holdings: true,
      snapshots: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  return accounts
    .map(account => {
      const startingBalance = Number(account.startingBalance)
      const cashBalance = Number(account.cashBalance)
      // Prefer last snapshot; fall back to cash + holdings at cost basis if no snapshot yet
      const totalValue = account.snapshots[0]
        ? Number(account.snapshots[0].totalValue)
        : cashBalance + account.holdings.reduce((sum, h) => {
            const qty = Number(h.quantity)
            const costBasis = Number(h.avgCostBasis)
            // Longs add value, shorts are liabilities
            return sum + qty * costBasis
          }, 0)
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
      }
    })
    .sort((a, b) => b.returnPercent - a.returnPercent)
    .map((entry, i) => ({ ...entry, rank: i + 1 }))
}
