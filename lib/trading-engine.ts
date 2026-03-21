import { db } from './db'
import { getQuote } from './market-data'
import type { AssetType, TradeSide } from '@/types'

interface TradeInput {
  accountId: string
  symbol: string
  assetType: AssetType
  side: TradeSide
  quantity: number
}

interface TradeResult {
  success: boolean
  error?: string
  trade?: {
    id: string
    symbol: string
    side: TradeSide
    quantity: number
    price: number
    totalValue: number
  }
}

export async function executeTrade(input: TradeInput): Promise<TradeResult> {
  const { accountId, symbol, assetType, side, quantity } = input

  if (quantity <= 0) return { success: false, error: 'Quantity must be greater than 0' }

  // Get live price
  let quote
  try {
    quote = await getQuote(symbol, assetType)
  } catch {
    return { success: false, error: 'Failed to fetch current price. Please try again.' }
  }

  const price = quote.price
  const totalValue = price * quantity

  return await db.$transaction(async (tx) => {
    const account = await tx.paperAccount.findUnique({ where: { id: accountId } })
    if (!account) return { success: false, error: 'Account not found' }

    const cashBalance = Number(account.cashBalance)

    if (side === 'BUY') {
      if (cashBalance < totalValue) {
        return {
          success: false,
          error: `Insufficient funds. Need ${formatCurrency(totalValue)}, have ${formatCurrency(cashBalance)}`,
        }
      }

      // Update or create holding with weighted average cost basis
      const existing = await tx.holding.findUnique({
        where: { accountId_symbol: { accountId, symbol } },
      })

      if (existing) {
        const existingQty = Number(existing.quantity)
        const existingCost = Number(existing.avgCostBasis)
        const newQty = existingQty + quantity
        const newAvgCost = (existingQty * existingCost + quantity * price) / newQty

        await tx.holding.update({
          where: { id: existing.id },
          data: { quantity: newQty, avgCostBasis: newAvgCost },
        })
      } else {
        await tx.holding.create({
          data: { accountId, symbol, assetType, quantity, avgCostBasis: price },
        })
      }

      await tx.paperAccount.update({
        where: { id: accountId },
        data: { cashBalance: cashBalance - totalValue },
      })
    } else {
      // SELL
      const holding = await tx.holding.findUnique({
        where: { accountId_symbol: { accountId, symbol } },
      })

      if (!holding) return { success: false, error: `You don't hold any ${symbol}` }

      const heldQty = Number(holding.quantity)
      if (heldQty < quantity) {
        return {
          success: false,
          error: `Insufficient holdings. Have ${formatQuantity(heldQty, assetType)}, trying to sell ${formatQuantity(quantity, assetType)}`,
        }
      }

      const avgCost = Number(holding.avgCostBasis)
      const realizedPnl = (price - avgCost) * quantity
      const newQty = heldQty - quantity

      if (newQty < 1e-8) {
        // Close position
        await tx.holding.delete({ where: { id: holding.id } })
      } else {
        await tx.holding.update({
          where: { id: holding.id },
          data: {
            quantity: newQty,
            realizedPnl: Number(holding.realizedPnl) + realizedPnl,
          },
        })
      }

      await tx.paperAccount.update({
        where: { id: accountId },
        data: { cashBalance: cashBalance + totalValue },
      })
    }

    const trade = await tx.trade.create({
      data: {
        accountId,
        symbol,
        assetType,
        assetName: quote.name,
        side,
        quantity,
        price,
        totalValue,
      },
    })

    // Save portfolio snapshot after every trade
    await saveSnapshot(tx, accountId)

    return {
      success: true,
      trade: {
        id: trade.id,
        symbol: trade.symbol,
        side: trade.side as TradeSide,
        quantity: Number(trade.quantity),
        price: Number(trade.price),
        totalValue: Number(trade.totalValue),
      },
    }
  })
}

async function saveSnapshot(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  accountId: string
) {
  const account = await tx.paperAccount.findUnique({
    where: { id: accountId },
    include: { holdings: true },
  })
  if (!account) return

  // Use stored prices (approximate) for snapshot — full recalc happens in portfolio endpoint
  const holdingsValue = account.holdings.reduce(
    (sum, h) => sum + Number(h.quantity) * Number(h.avgCostBasis),
    0
  )

  await tx.portfolioSnapshot.create({
    data: {
      accountId,
      totalValue: Number(account.cashBalance) + holdingsValue,
      cashBalance: Number(account.cashBalance),
    },
  })
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function formatQuantity(value: number, assetType: AssetType): string {
  if (assetType === 'CRYPTO') return value.toFixed(6)
  return value.toFixed(4)
}
