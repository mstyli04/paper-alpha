// lib/bot/trade-executor.ts
import { executeTrade } from '@/lib/trading-engine'
import type { AssetType } from '@/types'
import type { Signal } from './signal-engine'

export interface ExecutionResult {
  success: boolean
  symbol: string
  action: 'BUY' | 'SELL'
  quantity: number
  error?: string
}

/** Calls executeTrade() directly (no HTTP). Returns result for logging. */
export async function executeSignal(
  accountId: string,
  signal: Signal,
  quantity: number,
  assetType: AssetType
): Promise<ExecutionResult> {
  if (signal.action === 'HOLD' || quantity <= 0) {
    return { success: true, symbol: signal.symbol, action: 'BUY', quantity: 0 }
  }

  const side = signal.action as 'BUY' | 'SELL'
  const note = `Bot: ${signal.strategy} ${side} | conviction ${signal.conviction.toFixed(2)} | regime ${signal.regime}`

  const result = await executeTrade({
    accountId,
    symbol: signal.symbol,
    assetType,
    side,
    quantity,
    note,
    reason: signal.reason,
  })

  return {
    success: result.success,
    symbol: signal.symbol,
    action: side,
    quantity,
    error: result.error,
  }
}
