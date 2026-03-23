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

  const priceMap = new Map<string, number>()
  await Promise.allSettled(
    Array.from(uniqueSymbols.values()).map(async ({ symbol, assetType }) => {
      const quote = await getQuote(symbol, assetType)
      priceMap.set(symbol, quote.price)
    })
  )

  return accounts
    .map(account => {
      const startingBalance = Number(account.startingBalance)
      const cashBalance = Number(account.cashBalance)
      const holdingsValue = account.holdings.reduce((sum, h) => {
        const qty = Number(h.quantity)
        // Fall back to cost basis if live price fetch failed
        const price = priceMap.get(h.symbol) ?? Number(h.avgCostBasis)
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
      }
    })
    .sort((a, b) => b.returnPercent - a.returnPercent)
    .map((entry, i) => ({ ...entry, rank: i + 1 }))
}
