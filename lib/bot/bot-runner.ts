import { db } from '@/lib/db'
import { getQuote } from '@/lib/market-data'
import { UNIVERSE } from './universe'
import { fetchBotCandles, fetchBotCandlesWeekly } from './market-data'
import { generateSignal } from './signal-engine'
import { calculatePositionSize } from './position-sizer'
import { executeSignal } from './trade-executor'
import { getSentimentScore, clearSentimentCache } from './sentiment'
import { atr } from './indicators'
import type { AssetType } from '@/types'
import type { Trade } from '@prisma/client'

const MAX_POSITIONS      = 10
const MAX_CRYPTO_PERCENT = 0.30
const MAX_SECTOR_PERCENT = 0.40
const MAX_DRAWDOWN       = 0.15
const CIRCUIT_BREAKER_CYCLES = 3

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

let circuitBreakerTriggeredAt: number | null = null

export interface BotRunResult {
  tradesExecuted: number
  skipped: number
  errors: string[]
}

export async function runBot(botAccountId: string): Promise<BotRunResult> {
  clearSentimentCache()
  const errors: string[] = []
  let tradesExecuted = 0
  let skipped = 0

  // 1. Circuit breaker check — bail before creating a run record
  if (circuitBreakerTriggeredAt !== null) {
    const daysSince = (Date.now() - circuitBreakerTriggeredAt) / (1000 * 60 * 60 * 24)
    if (daysSince < CIRCUIT_BREAKER_CYCLES) {
      const remaining = CIRCUIT_BREAKER_CYCLES - Math.floor(daysSince)
      return { tradesExecuted: 0, skipped: 0, errors: [`Circuit breaker active: ${remaining} cycles remaining`] }
    }
    circuitBreakerTriggeredAt = null
  }

  // 2. Load account state
  const account = await db.paperAccount.findUnique({
    where: { id: botAccountId },
    include: { holdings: true },
  })
  if (!account) throw new Error(`Bot account not found: ${botAccountId}`)

  const cashBalance     = Number(account.cashBalance)
  const startingBalance = Number(account.startingBalance)
  const holdingsValue   = account.holdings.reduce((sum, h) => sum + Number(h.quantity) * Number(h.avgCostBasis), 0)
  const portfolioValue  = cashBalance + holdingsValue

  // 3. Create run record now that we have the portfolio snapshot
  const run = await db.botRun.create({
    data: { startedAt: new Date(), portfolioValueSnapshot: portfolioValue, status: 'OK' },
  })

  // 4. Drawdown circuit breaker
  const drawdown = startingBalance > 0 ? (startingBalance - portfolioValue) / startingBalance : 0
  if (drawdown > MAX_DRAWDOWN) {
    circuitBreakerTriggeredAt = Date.now()
    for (const holding of account.holdings.filter(h => Number(h.quantity) > 0)) {
      await executeSignal(
        botAccountId,
        { symbol: holding.symbol, action: 'SELL', conviction: 1, strategy: 'MOMENTUM', regime: 'TRENDING' },
        Number(holding.quantity),
        holding.assetType as AssetType
      )
    }
    const msg = `Drawdown ${(drawdown * 100).toFixed(1)}% exceeded 15% — liquidated all positions`
    await db.botRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), status: 'ERROR', tradesExecuted: 0, skipped: 0, errors: [msg] },
    })
    return { tradesExecuted: 0, skipped: 0, errors: [msg] }
  }

  const holdingMap = new Map(account.holdings.map(h => [h.symbol, h]))

  // 5. Check ATR stop losses
  const activeStops = await db.stopOrder.findMany({ where: { accountId: botAccountId, status: 'ACTIVE' } })
  for (const stop of activeStops) {
    try {
      const quote = await getQuoteForSymbol(stop.symbol, stop.assetType as AssetType)
      const breached = stop.condition === 'BELOW'
        ? quote <= Number(stop.triggerPrice)
        : quote >= Number(stop.triggerPrice)
      if (breached) {
        const result = await executeSignal(
          botAccountId,
          { symbol: stop.symbol, action: 'SELL', conviction: 1, strategy: 'MOMENTUM', regime: 'TRENDING' },
          Number(stop.quantity),
          stop.assetType as AssetType
        )
        await db.stopOrder.update({
          where: { id: stop.id },
          data: { status: result.success ? 'TRIGGERED' : 'FAILED', triggeredAt: new Date() },
        })
        if (result.success) {
          tradesExecuted++
          await db.botRunAsset.create({
            data: {
              runId:       run.id,
              symbol:      stop.symbol,
              regime:      'UNKNOWN',
              signal:      'SELL',
              conviction:  1,
              action:      'SOLD',
              skipReason:  null,
              candleCount: 0,
            },
          })
          holdingMap.delete(stop.symbol)
        }
      }
    } catch {
      // skip — retry next cycle
    }
  }

  // 6. Process signals
  for (const asset of UNIVERSE) {
    const holding   = holdingMap.get(asset.symbol)
    const isHeld    = !!holding && Number(holding.quantity) > 0
    const openCount = account.holdings.filter(h => Number(h.quantity) > 0).length

    await sleep(200)
    const candles = await fetchBotCandles(asset.symbol, asset.assetType)
    if (candles.length < 30) {
      await db.botRunAsset.create({
        data: {
          runId:       run.id,
          symbol:      asset.symbol,
          regime:      'UNKNOWN',
          signal:      'UNKNOWN',
          conviction:  null,
          action:      'SKIPPED',
          skipReason:  `candles < 30 (got ${candles.length})`,
          candleCount: candles.length,
        },
      })
      skipped++
      continue
    }

    await sleep(200)
    const weeklyCandles  = await fetchBotCandlesWeekly(asset.symbol, asset.assetType)
    await sleep(200)
    const sentimentScore = await getSentimentScore(asset.symbol, candles)
    const signal = generateSignal(asset.symbol, candles, weeklyCandles, sentimentScore, isHeld)

    // SELL
    if (signal.action === 'SELL' && isHeld && holding) {
      const result = await executeSignal(botAccountId, signal, Number(holding.quantity), asset.assetType)
      await db.botRunAsset.create({
        data: {
          runId:       run.id,
          symbol:      asset.symbol,
          regime:      signal.regime,
          signal:      signal.action,
          conviction:  signal.conviction,
          action:      result.success ? 'SOLD' : 'ERROR',
          skipReason:  result.success ? null : `execution error: ${result.error}`,
          candleCount: candles.length,
        },
      })
      if (result.success) tradesExecuted++
      else errors.push(`SELL ${asset.symbol}: ${result.error}`)
      continue
    }

    // BUY
    if (signal.action === 'BUY' && !isHeld) {
      if (openCount >= MAX_POSITIONS) {
        await db.botRunAsset.create({
          data: {
            runId:       run.id,
            symbol:      asset.symbol,
            regime:      signal.regime,
            signal:      signal.action,
            conviction:  signal.conviction,
            action:      'SKIPPED',
            skipReason:  'max positions (10)',
            candleCount: candles.length,
          },
        })
        skipped++
        continue
      }

      if (asset.assetType === 'CRYPTO') {
        const cryptoValue = account.holdings
          .filter(h => h.assetType === 'CRYPTO' && Number(h.quantity) > 0)
          .reduce((sum, h) => sum + Number(h.quantity) * Number(h.avgCostBasis), 0)
        if (portfolioValue > 0 && cryptoValue / portfolioValue >= MAX_CRYPTO_PERCENT) {
          await db.botRunAsset.create({
            data: {
              runId:       run.id,
              symbol:      asset.symbol,
              regime:      signal.regime,
              signal:      signal.action,
              conviction:  signal.conviction,
              action:      'SKIPPED',
              skipReason:  'crypto cap 30%',
              candleCount: candles.length,
            },
          })
          skipped++
          continue
        }
      }

      const sectorSymbols = UNIVERSE.filter(u => u.sector === asset.sector).map(u => u.symbol)
      const sectorValue = account.holdings
        .filter(h => sectorSymbols.includes(h.symbol) && Number(h.quantity) > 0)
        .reduce((sum, h) => sum + Number(h.quantity) * Number(h.avgCostBasis), 0)
      if (portfolioValue > 0 && sectorValue / portfolioValue >= MAX_SECTOR_PERCENT) {
        await db.botRunAsset.create({
          data: {
            runId:       run.id,
            symbol:      asset.symbol,
            regime:      signal.regime,
            signal:      signal.action,
            conviction:  signal.conviction,
            action:      'SKIPPED',
            skipReason:  'sector cap 40%',
            candleCount: candles.length,
          },
        })
        skipped++
        continue
      }

      let price: number
      try {
        price = await getQuoteForSymbol(asset.symbol, asset.assetType)
      } catch {
        await db.botRunAsset.create({
          data: {
            runId:       run.id,
            symbol:      asset.symbol,
            regime:      signal.regime,
            signal:      signal.action,
            conviction:  signal.conviction,
            action:      'SKIPPED',
            skipReason:  'price fetch failed',
            candleCount: candles.length,
          },
        })
        skipped++
        continue
      }

      const trades = await db.trade.findMany({
        where: { accountId: botAccountId, symbol: asset.symbol },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      const { winRate, avgWinLossRatio } = computeEdge(trades)

      const quantity = calculatePositionSize({
        portfolioValue,
        price,
        conviction: signal.conviction,
        assetType: asset.assetType === 'CRYPTO' ? 'CRYPTO' : 'STOCK',
        winRate,
        avgWinLossRatio,
      })

      if (quantity <= 0) {
        await db.botRunAsset.create({
          data: {
            runId:       run.id,
            symbol:      asset.symbol,
            regime:      signal.regime,
            signal:      signal.action,
            conviction:  signal.conviction,
            action:      'SKIPPED',
            skipReason:  'quantity 0 (low conviction or price too high)',
            candleCount: candles.length,
          },
        })
        skipped++
        continue
      }

      if (price * quantity > cashBalance) {
        await db.botRunAsset.create({
          data: {
            runId:       run.id,
            symbol:      asset.symbol,
            regime:      signal.regime,
            signal:      signal.action,
            conviction:  signal.conviction,
            action:      'SKIPPED',
            skipReason:  'insufficient cash',
            candleCount: candles.length,
          },
        })
        skipped++
        continue
      }

      const result = await executeSignal(botAccountId, signal, quantity, asset.assetType)
      await db.botRunAsset.create({
        data: {
          runId:       run.id,
          symbol:      asset.symbol,
          regime:      signal.regime,
          signal:      signal.action,
          conviction:  signal.conviction,
          action:      result.success ? 'BOUGHT' : 'ERROR',
          skipReason:  result.success ? null : `execution error: ${result.error}`,
          candleCount: candles.length,
        },
      })
      if (result.success) {
        tradesExecuted++
        // Create ATR stop loss
        const atrValues = atr(candles, 14)
        if (atrValues.length > 0) {
          const stopPrice = price - 2 * atrValues[atrValues.length - 1]
          await db.stopOrder.create({
            data: {
              accountId:    botAccountId,
              symbol:       asset.symbol,
              assetType:    asset.assetType,
              side:         'SELL',
              triggerPrice: stopPrice,
              condition:    'BELOW',
              quantity:     quantity,
              status:       'ACTIVE',
            },
          })
        }
      } else {
        errors.push(`BUY ${asset.symbol}: ${result.error}`)
      }
      continue
    }

    // HOLD (or SELL-not-held, or BUY-already-held) — log as skipped
    await db.botRunAsset.create({
      data: {
        runId:       run.id,
        symbol:      asset.symbol,
        regime:      signal.regime,
        signal:      signal.action,
        conviction:  signal.conviction,
        action:      'SKIPPED',
        skipReason:  signal.skipReason ?? 'signal HOLD',
        candleCount: candles.length,
      },
    })
    skipped++
  }

  // 7. Finalise run record
  await db.botRun.update({
    where: { id: run.id },
    data: {
      finishedAt:     new Date(),
      status:         errors.length > 0 ? 'ERROR' : 'OK',
      tradesExecuted,
      skipped,
      errors,
    },
  })

  // 8. Purge runs older than 90 days (cascades to BotRunAsset)
  await db.botRun.deleteMany({
    where: { startedAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
  })

  return { tradesExecuted, skipped, errors }
}

async function getQuoteForSymbol(symbol: string, assetType: AssetType): Promise<number> {
  const quote = await getQuote(symbol, assetType)
  return quote.price
}

function computeEdge(trades: Trade[]): { winRate: number; avgWinLossRatio: number } {
  const pairs: { pnl: number }[] = []
  for (let i = 0; i < trades.length - 1; i++) {
    const sell = trades[i]
    const buy  = trades[i + 1]
    if (sell.side === 'SELL' && buy.side === 'BUY') {
      pairs.push({ pnl: Number(sell.price) - Number(buy.price) })
    }
  }
  if (pairs.length === 0) return { winRate: 0.55, avgWinLossRatio: 1.5 }
  const wins   = pairs.filter(p => p.pnl > 0)
  const losses = pairs.filter(p => p.pnl <= 0)
  const winRate = wins.length / pairs.length
  const avgWin  = wins.length   > 0 ? wins.reduce((s, p) => s + p.pnl, 0) / wins.length     : 1
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, p) => s + p.pnl, 0) / losses.length) : 1
  return { winRate: winRate || 0.55, avgWinLossRatio: avgLoss > 0 ? avgWin / avgLoss : 1.5 }
}
