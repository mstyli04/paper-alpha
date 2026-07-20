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

const EPSILON = new Decimal('1e-8')

export async function executeTrade(input: TradeInput): Promise<TradeResult> {
  const { accountId, symbol, assetType, side, quantity: quantityInput, note, reason } = input

  if (quantityInput <= 0) return { success: false, error: 'Quantity must be greater than 0' }

  let quote
  try {
    quote = await getQuote(symbol, assetType)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to fetch price: ${msg}` }
  }

  const price = new Decimal(quote.price)
  const quantity = new Decimal(quantityInput)
  const totalValue = price.times(quantity)

  return await db.$transaction(async (tx) => {
    // Lock the account row for the duration of the transaction so a second
    // concurrent trade on the same account can't read a pre-write balance —
    // without this, two overlapping trades can both read the same starting
    // cashBalance and the second UPDATE silently clobbers the first
    // (lost-update / double-spend).
    const locked = await tx.$queryRaw<{ cashBalance: Decimal }[]>`
      SELECT "cashBalance" FROM "PaperAccount" WHERE id = ${accountId} FOR UPDATE
    `
    if (!locked[0]) return { success: false, error: 'Account not found' }

    const cashBalance = new Decimal(locked[0].cashBalance.toString())

    const existing = await tx.holding.findUnique({
      where: { accountId_symbol: { accountId, symbol } },
    })

    const currentQty = existing ? new Decimal(existing.quantity.toString()) : new Decimal(0)

    if (side === 'BUY') {
      // BUY: add to long position (or reduce a short position if currentQty < 0)
      if (cashBalance.lessThan(totalValue)) {
        return {
          success: false,
          error: `Insufficient funds. Need ${formatCurrency(totalValue)}, have ${formatCurrency(cashBalance)}`,
        }
      }

      if (currentQty.lessThan(0)) {
        // Covering a short — buying back borrowed shares
        const coveredQty = Decimal.min(quantity, currentQty.abs())
        const remainingBuy = quantity.minus(coveredQty)
        const avgShortPrice = new Decimal(existing!.avgCostBasis.toString())
        const realizedPnl = avgShortPrice.minus(price).times(coveredQty)

        const newQty = currentQty.plus(quantity)

        if (newQty.abs().lessThan(EPSILON)) {
          await tx.holding.delete({ where: { id: existing!.id } })
        } else if (newQty.lessThan(0)) {
          // Still short after covering partial
          await tx.holding.update({
            where: { id: existing!.id },
            data: {
              quantity: newQty,
              realizedPnl: new Decimal(existing!.realizedPnl.toString()).plus(realizedPnl),
            },
          })
        } else {
          // Flipped to long
          await tx.holding.update({
            where: { id: existing!.id },
            data: {
              quantity: newQty,
              avgCostBasis: remainingBuy.greaterThan(0) ? price : existing!.avgCostBasis,
              realizedPnl: new Decimal(existing!.realizedPnl.toString()).plus(realizedPnl),
            },
          })
        }
      } else {
        // Normal long buy
        if (existing) {
          const newQty = currentQty.plus(quantity)
          const newAvgCost = currentQty
            .times(existing.avgCostBasis.toString())
            .plus(quantity.times(price))
            .dividedBy(newQty)
          await tx.holding.update({
            where: { id: existing.id },
            data: { quantity: newQty, avgCostBasis: newAvgCost },
          })
        } else {
          await tx.holding.create({
            data: { accountId, symbol, assetType, quantity, avgCostBasis: price },
          })
        }
      }

      await tx.paperAccount.update({
        where: { id: accountId },
        data: { cashBalance: cashBalance.minus(totalValue) },
      })

    } else if (side === 'SELL') {
      // SELL: reduce long position
      if (!existing || currentQty.lessThanOrEqualTo(0)) {
        return { success: false, error: `You don't hold any ${symbol} to sell` }
      }
      if (currentQty.lessThan(quantity)) {
        return {
          success: false,
          error: `Insufficient holdings. Have ${formatQuantity(currentQty, assetType)}, trying to sell ${formatQuantity(quantity, assetType)}`,
        }
      }

      const avgCost = new Decimal(existing.avgCostBasis.toString())
      const realizedPnl = price.minus(avgCost).times(quantity)
      const newQty = currentQty.minus(quantity)

      if (newQty.lessThan(EPSILON)) {
        await tx.holding.delete({ where: { id: existing.id } })
      } else {
        await tx.holding.update({
          where: { id: existing.id },
          data: { quantity: newQty, realizedPnl: new Decimal(existing.realizedPnl.toString()).plus(realizedPnl) },
        })
      }

      await tx.paperAccount.update({
        where: { id: accountId },
        data: { cashBalance: cashBalance.plus(totalValue) },
      })

    } else if (side === 'SHORT') {
      // SHORT: sell borrowed shares, receive cash, create negative holding
      if (existing && currentQty.greaterThan(0)) {
        return {
          success: false,
          error: `You already hold ${symbol} long. Sell your position first before shorting.`,
        }
      }

      if (existing && currentQty.lessThan(0)) {
        // Add to existing short
        const newQty = currentQty.minus(quantity)
        const newAvgCost = currentQty
          .abs()
          .times(existing.avgCostBasis.toString())
          .plus(quantity.times(price))
          .dividedBy(newQty.abs())
        await tx.holding.update({
          where: { id: existing.id },
          data: { quantity: newQty, avgCostBasis: newAvgCost },
        })
      } else {
        // New short position (negative quantity)
        await tx.holding.create({
          data: { accountId, symbol, assetType, quantity: quantity.negated(), avgCostBasis: price },
        })
      }

      // You receive cash when you short (borrowing and selling the shares)
      await tx.paperAccount.update({
        where: { id: accountId },
        data: { cashBalance: cashBalance.plus(totalValue) },
      })

    } else {
      // COVER: close a short position
      if (!existing || currentQty.greaterThanOrEqualTo(0)) {
        return { success: false, error: `You don't have a short position in ${symbol}` }
      }

      const maxCover = currentQty.abs()
      if (quantity.greaterThan(maxCover)) {
        return {
          success: false,
          error: `Can only cover up to ${formatQuantity(maxCover, assetType)} shares`,
        }
      }

      if (cashBalance.lessThan(totalValue)) {
        return {
          success: false,
          error: `Insufficient funds to cover. Need ${formatCurrency(totalValue)}, have ${formatCurrency(cashBalance)}`,
        }
      }

      const avgShortPrice = new Decimal(existing.avgCostBasis.toString())
      const realizedPnl = avgShortPrice.minus(price).times(quantity)
      const newQty = currentQty.plus(quantity)

      if (newQty.abs().lessThan(EPSILON)) {
        await tx.holding.delete({ where: { id: existing.id } })
      } else {
        await tx.holding.update({
          where: { id: existing.id },
          data: { quantity: newQty, realizedPnl: new Decimal(existing.realizedPnl.toString()).plus(realizedPnl) },
        })
      }

      await tx.paperAccount.update({
        where: { id: accountId },
        data: { cashBalance: cashBalance.minus(totalValue) },
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

  // Value holdings at live market price (falling back to cost basis if a
  // quote fetch fails), matching the cron snapshot job and the leaderboard —
  // valuing at cost basis here instead would silently understate/overstate
  // unrealized P&L on any snapshot taken right after a trade.
  const priceResults = await Promise.allSettled(
    account.holdings.map(h => getQuote(h.symbol, h.assetType as AssetType))
  )

  const holdingsValue = account.holdings.reduce((sum, h, i) => {
    const result = priceResults[i]
    const price = result.status === 'fulfilled' ? result.value.price : Number(h.avgCostBasis)
    const qty = Number(h.quantity)
    // Shorts (negative qty) are liabilities — reduce total value
    return sum + qty * price
  }, 0)

  const cashBalance = Number(account.cashBalance)

  await tx.portfolioSnapshot.create({
    data: {
      accountId,
      totalValue: cashBalance + holdingsValue,
      cashBalance,
    },
  })
}

function formatCurrency(value: Decimal | number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    typeof value === 'number' ? value : value.toNumber()
  )
}

function formatQuantity(value: Decimal | number, assetType: AssetType): string {
  const n = typeof value === 'number' ? value : value.toNumber()
  if (assetType === 'CRYPTO') return n.toFixed(6)
  return n.toFixed(4)
}
