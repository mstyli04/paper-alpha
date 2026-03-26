import type { AssetType } from '@/types'

export interface PositionSizeInput {
  portfolioValue: number
  price: number
  conviction: number
  assetType: AssetType
  winRate?: number
  avgWinLossRatio?: number
}

const MAX_POSITION_FRACTION = 0.05
const CRYPTO_DECIMALS = 6

export function calculatePositionSize(input: PositionSizeInput): number {
  const { portfolioValue, price, conviction, assetType, winRate = 0.55, avgWinLossRatio = 1.5 } = input

  if (price <= 0 || conviction <= 0 || portfolioValue <= 0) return 0

  const kelly     = (winRate * avgWinLossRatio - (1 - winRate)) / avgWinLossRatio
  const halfKelly = Math.max(0, kelly * 0.5)
  const rawDollar  = portfolioValue * halfKelly * conviction
  const capDollar  = portfolioValue * MAX_POSITION_FRACTION
  const dollarSize = Math.min(rawDollar, capDollar)
  const rawQuantity = dollarSize / price

  if (assetType === 'CRYPTO') {
    const factor = Math.pow(10, CRYPTO_DECIMALS)
    return Math.floor(rawQuantity * factor) / factor
  }

  return Math.floor(rawQuantity)
}
