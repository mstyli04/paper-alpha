import Anthropic from '@anthropic-ai/sdk'
import type { CandleData } from '@/types'

const client = new Anthropic()

// Per-run cache — cleared by clearSentimentCache() at the start of each cron cycle
const cache = new Map<string, number>()

export function clearSentimentCache(): void {
  cache.clear()
}

/**
 * Returns a sentiment score in [-1.0, +1.0] for the given symbol.
 * Uses recent price + volume context. Cached per cron cycle.
 * Returns 0 (neutral) on any error.
 */
export async function getSentimentScore(
  symbol: string,
  candles: CandleData[]
): Promise<number> {
  if (cache.has(symbol)) return cache.get(symbol)!

  const recent  = candles.slice(-5)
  const closes  = recent.map(c => c.close.toFixed(2)).join(', ')
  const volumes = recent.map(c => ((c.volume ?? 0) / 1000).toFixed(0) + 'k').join(', ')
  const pctChange = recent.length >= 2
    ? (((recent[recent.length - 1].close - recent[0].close) / recent[0].close) * 100).toFixed(2)
    : '0'

  const prompt =
    `You are a quantitative analyst. Based only on the price and volume data below for ${symbol}, ` +
    `return a JSON object with one field "score": a number between -1.0 (very bearish) and 1.0 (very bullish). ` +
    `0.0 means neutral.\n\n` +
    `Recent closes (5 days): ${closes}\n` +
    `Recent volumes: ${volumes}\n` +
    `5-day price change: ${pctChange}%\n\n` +
    `Respond with ONLY valid JSON, e.g.: {"score": 0.3}`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      messages: [{ role: 'user', content: prompt }],
    })

    const text   = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const parsed = JSON.parse(text)
    const score  = Math.max(-1, Math.min(1, Number(parsed.score) || 0))
    cache.set(symbol, score)
    return score
  } catch {
    cache.set(symbol, 0)
    return 0
  }
}
