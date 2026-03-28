import type { CandleData, AssetType } from '@/types'
import { getCandles } from '@/lib/market-data'

const CANDLE_DAYS         = 60
const WEEKLY_CANDLE_WEEKS = 52

/** Fetch 60 daily OHLCV candles for a symbol. Returns empty array on failure. */
export async function fetchBotCandles(
  symbol: string,
  assetType: AssetType
): Promise<CandleData[]> {
  const to   = Math.floor(Date.now() / 1000)
  const from = to - CANDLE_DAYS * 24 * 60 * 60

  try {
    const candles = await getCandles(symbol, assetType, 'D', from, to)
    return candles ?? []
  } catch {
    return []
  }
}

/** Fetch ~52 weekly OHLCV candles for a symbol. Returns empty array on failure. */
export async function fetchBotCandlesWeekly(
  symbol: string,
  assetType: AssetType
): Promise<CandleData[]> {
  const to   = Math.floor(Date.now() / 1000)
  const from = to - WEEKLY_CANDLE_WEEKS * 7 * 24 * 60 * 60

  try {
    const candles = await getCandles(symbol, assetType, 'W', from, to)
    return candles ?? []
  } catch {
    return []
  }
}
