export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getStockQuote, getStockCandles } from '@/lib/market-data/finnhub'
import { getCryptoQuote, getCryptoCandles } from '@/lib/market-data/coingecko'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI commentary not configured' }, { status: 503 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get('symbol')
  const assetType = (searchParams.get('assetType') || 'STOCK').toUpperCase()

  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })

  try {
    // Fetch quote and recent candles in parallel
    const to = Math.floor(Date.now() / 1000)
    const from = to - 30 * 86400

    const [quote, candles] = await Promise.all([
      assetType === 'CRYPTO' ? getCryptoQuote(symbol) : getStockQuote(symbol),
      assetType === 'CRYPTO'
        ? getCryptoCandles(symbol, 'D', from, to).catch(() => [])
        : getStockCandles(symbol, 'D', from, to).catch(() => []),
    ])

    // Fetch recent headlines
    let headlines: string[] = []
    try {
      const apiKey = process.env.FINNHUB_API_KEY
      if (assetType === 'STOCK' && apiKey) {
        const toDate = new Date(to * 1000).toISOString().split('T')[0]
        const fromDate = new Date((to - 7 * 86400) * 1000).toISOString().split('T')[0]
        const res = await fetch(
          `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${apiKey}`
        )
        if (res.ok) {
          const news = await res.json()
          headlines = (news || []).slice(0, 5).map((n: { headline: string }) => n.headline)
        }
      }
    } catch {}

    // Build price summary from candles
    const closes = candles.map(c => c.close)
    const priceChange30d =
      closes.length >= 2
        ? (((closes[closes.length - 1] - closes[0]) / closes[0]) * 100).toFixed(1)
        : null

    // Build prompt context
    const priceInfo = quote
      ? `Current price: $${quote.price.toLocaleString()}, today's change: ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%${priceChange30d ? `, 30-day change: ${priceChange30d}%` : ''}`
      : 'Price data unavailable'

    const newsContext =
      headlines.length > 0
        ? `Recent headlines:\n${headlines.map(h => `- ${h}`).join('\n')}`
        : 'No recent news available'

    const prompt = `You are a financial analyst providing a brief, factual market commentary. Do NOT give investment advice or recommendations.

Asset: ${symbol} (${assetType === 'CRYPTO' ? 'Cryptocurrency' : 'Stock'})
${priceInfo}
${newsContext}

Write 2-3 sentences explaining what is driving ${symbol}'s recent price action based on the data above. Be concise and objective. Focus on observable facts. End with one sentence about the current market sentiment (bullish/bearish/mixed) based on the news.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const commentary =
      message.content[0].type === 'text' ? message.content[0].text : ''

    return NextResponse.json({ commentary, symbol, assetType })
  } catch (err) {
    console.error('Commentary error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to generate commentary' }, { status: 500 })
  }
}
