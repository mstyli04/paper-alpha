import { db } from './db'
import { getQuote } from './market-data'
import type { Portfolio, Holding } from '@/types'

export async function getPortfolio(accountId: string): Promise<Portfolio> {
  const account = await db.paperAccount.findUnique({
    where: { id: accountId },
    include: { holdings: true },
  })

  if (!account) throw new Error('Account not found')

  const cashBalance = Number(account.cashBalance)
  const startingBalance = Number(account.startingBalance)

  // Fetch live prices for all holdings in parallel
  const priceResults = await Promise.allSettled(
    account.holdings.map(h => getQuote(h.symbol, h.assetType as 'STOCK' | 'CRYPTO'))
  )

  const holdings: Holding[] = account.holdings.map((h, i) => {
    const priceResult = priceResults[i]
    const currentPrice = priceResult.status === 'fulfilled' ? priceResult.value.price : Number(h.avgCostBasis)
    const quantity = Number(h.quantity)
    const avgCostBasis = Number(h.avgCostBasis)
    const currentValue = currentPrice * quantity
    const unrealizedPnl = (currentPrice - avgCostBasis) * quantity
    const unrealizedPnlPercent = avgCostBasis > 0 ? ((currentPrice - avgCostBasis) / avgCostBasis) * 100 : 0

    return {
      id: h.id,
      symbol: h.symbol,
      assetType: h.assetType as 'STOCK' | 'CRYPTO',
      quantity,
      avgCostBasis,
      realizedPnl: Number(h.realizedPnl),
      currentPrice,
      currentValue,
      unrealizedPnl,
      unrealizedPnlPercent,
    }
  })

  const totalInvested = holdings.reduce((sum, h) => sum + h.avgCostBasis * h.quantity, 0)
  const holdingsValue = holdings.reduce((sum, h) => sum + (h.currentValue ?? 0), 0)
  const totalValue = cashBalance + holdingsValue
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
    include: { user: true, holdings: true },
  })

  const entries = await Promise.all(
    accounts.map(async (account) => {
      const portfolio = await getPortfolio(account.id).catch(() => null)
      if (!portfolio) return null

      return {
        userId: account.userId,
        username: account.user.username,
        avatarUrl: account.user.avatarUrl ?? undefined,
        totalValue: portfolio.totalValue,
        startingBalance: portfolio.startingBalance,
        returnPercent: portfolio.totalPnlPercent,
        totalPnl: portfolio.totalPnl,
      }
    })
  )

  return entries
    .filter((e): e is NonNullable<typeof entries[0]> => e !== null)
    .sort((a, b) => b.returnPercent - a.returnPercent)
    .map((entry, i) => ({ ...entry, rank: i + 1 }))
}
