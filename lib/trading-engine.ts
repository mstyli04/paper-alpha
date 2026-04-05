import { Decimal } from 'decimal.js'
import { db } from './db'
import { getQuote } from './market-data'
import type { AssetType, TradeSide } from '@/types'

interface TradeInput {
  accountId: string
  symbol: string
  assetType: AssetType
  side: TradeSide
  quantity: number
  note?: string
  reason?: string
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
  const { accountId, symbol, assetType, side, quantity, note, reason } = input

  if (quantity <= 0) return { success: false, error: 'Quantity must be greater than 0' }

  let quote
  try {
    quote = await getQuote(symbol, assetType)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to fetch price: ${msg}` }
  }

  const price = quote.price
  const totalValue = price * quantity

  return await db.$transaction(async (tx) => {
    const account = await tx.paperAccount.findUnique({ where: { id: accountId } })
    if (!account) return { success: false, error: 'Account not found' }

    const cashBalance = Number(account.cashBalance)

    const existing = await tx.holding.findUnique({
      where: { accountId_symbol: { accountId, symbol } },
    })

    const currentQty = existing ? Number(existing.quantity) : 0

    if (side === 'BUY') {
      // BUY: add to long position (or reduce a short position if currentQty < 0)
      if (cashBalance < totalValue) {
        return {
          success: false,
          error: `Insufficient funds. Need ${formatCurrency(totalValue)}, have ${formatCurrency(cashBalance)}`,
        }
      }

      if (currentQty < 0) {
        // Covering a short — buying back borrowed shares
        const coveredQty = Math.min(quantity, Math.abs(currentQty))
        const remainingBuy = quantity - coveredQty
        const avgShortPrice = Number(existing!.avgCostBasis)
        const realizedPnl = new Decimal(avgShortPrice).minus(price).times(coveredQty).toNumber()

        const newQty = currentQty + quantity

        if (Math.abs(newQty) < 1e-8) {
          await tx.holding.delete({ where: { id: existing!.id } })
        } else if (newQty < 0) {
          // Still short after covering partial
          await tx.holding.update({
            where: { id: existing!.id },
            data: {
              quantity: newQty,
              realizedPnl: new Decimal(Number(existing!.realizedPnl)).plus(realizedPnl).toNumber(),
            },
          })
        } else {
          // Flipped to long
          await tx.holding.update({
            where: { id: existing!.id },
            data: {
              quantity: newQty,
              avgCostBasis: remainingBuy > 0 ? price : existing!.avgCostBasis,
              realizedPnl: new Decimal(Number(existing!.realizedPnl)).plus(realizedPnl).toNumber(),
            },
          })
        }
      } else {
        // Normal long buy
        if (existing) {
          const newQty = new Decimal(currentQty).plus(quantity)
          const newAvgCost = new Decimal(currentQty)
            .times(Number(existing.avgCostBasis))
            .plus(new Decimal(quantity).times(price))
            .dividedBy(newQty)
            .toNumber()
          await tx.holding.update({
            where: { id: existing.id },
            data: { quantity: newQty.toNumber(), avgCostBasis: newAvgCost },
          })
        } else {
          await tx.holding.create({
            data: { accountId, symbol, assetType, quantity, avgCostBasis: price },
          })
        }
      }

      await tx.paperAccount.update({
        where: { id: accountId },
        data: { cashBalance: cashBalance - totalValue },
      })

    } else if (side === 'SELL') {
      // SELL: reduce long position
      if (!existing || currentQty <= 0) {
        return { success: false, error: `You don't hold any ${symbol} to sell` }
      }
      if (currentQty < quantity) {
        return {
          success: false,
          error: `Insufficient holdings. Have ${formatQuantity(currentQty, assetType)}, trying to sell ${formatQuantity(quantity, assetType)}`,
        }
      }

      const avgCost = Number(existing.avgCostBasis)
      const realizedPnl = new Decimal(price).minus(avgCost).times(quantity).toNumber()
      const newQty = currentQty - quantity

      if (newQty < 1e-8) {
        await tx.holding.delete({ where: { id: existing.id } })
      } else {
        await tx.holding.update({
          where: { id: existing.id },
          data: { quantity: newQty, realizedPnl: new Decimal(Number(existing.realizedPnl)).plus(realizedPnl).toNumber() },
        })
      }

      await tx.paperAccount.update({
        where: { id: accountId },
        data: { cashBalance: cashBalance + totalValue },
      })

    } else if (side === 'SHORT') {
      // SHORT: sell borrowed shares, receive cash, create negative holding
      if (existing && currentQty > 0) {
        return {
          success: false,
          error: `You already hold ${symbol} long. Sell your position first before shorting.`,
        }
      }

      if (existing && currentQty < 0) {
        // Add to existing short
        const newQty = new Decimal(currentQty).minus(quantity)
        const newAvgCost = new Decimal(Math.abs(currentQty))
          .times(Number(existing.avgCostBasis))
          .plus(new Decimal(quantity).times(price))
          .dividedBy(newQty.abs())
          .toNumber()
        await tx.holding.update({
          where: { id: existing.id },
          data: { quantity: newQty.toNumber(), avgCostBasis: newAvgCost },
        })
      } else {
        // New short position (negative quantity)
        await tx.holding.create({
          data: { accountId, symbol, assetType, quantity: -quantity, avgCostBasis: price },
        })
      }

      // You receive cash when you short (borrowing and selling the shares)
      await tx.paperAccount.update({
        where: { id: accountId },
        data: { cashBalance: cashBalance + totalValue },
      })

    } else {
      // COVER: close a short position
      if (!existing || currentQty >= 0) {
        return { success: false, error: `You don't have a short position in ${symbol}` }
      }

      const maxCover = Math.abs(currentQty)
      if (quantity > maxCover) {
        return {
          success: false,
          error: `Can only cover up to ${formatQuantity(maxCover, assetType)} shares`,
        }
      }

      if (cashBalance < totalValue) {
        return {
          success: false,
          error: `Insufficient funds to cover. Need ${formatCurrency(totalValue)}, have ${formatCurrency(cashBalance)}`,
        }
      }

      const avgShortPrice = Number(existing.avgCostBasis)
      const realizedPnl = new Decimal(avgShortPrice).minus(price).times(quantity).toNumber()
      const newQty = currentQty + quantity

      if (Math.abs(newQty) < 1e-8) {
        await tx.holding.delete({ where: { id: existing.id } })
      } else {
        await tx.holding.update({
          where: { id: existing.id },
          data: { quantity: newQty, realizedPnl: new Decimal(Number(existing.realizedPnl)).plus(realizedPnl).toNumber() },
        })
      }

      await tx.paperAccount.update({
        where: { id: accountId },
        data: { cashBalance: cashBalance - totalValue },
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
        note,
        reason,
      },
    })

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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

function formatQuantity(value: number, assetType: AssetType): string {
  if (assetType === 'CRYPTO') return value.toFixed(6)
  return value.toFixed(4)
}
