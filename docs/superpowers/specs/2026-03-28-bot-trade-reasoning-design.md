# Bot Trade Reasoning — Design Spec
**Date:** 2026-03-28
**Project:** Paper Alpha
**Status:** Approved

---

## Problem

Bot trades currently store a raw signal dump in the `note` field (e.g. `"Bot: MOMENTUM BUY | conviction 0.75 | regime TRENDING"`). This is not human-readable and does not include the new algo-v2 signals (MACD, ADX, weekly gate, sentiment). There is no way to see at a glance why the bot made a trade.

---

## Solution

Add a `reason` field to the `Trade` model. The bot generates a human-readable sentence for every trade it executes and stores it there. The history tab displays it as a dedicated "Reason" column.

---

## Scope

**Modified files:**
- `prisma/schema.prisma` — add `reason String?` to `Trade` model
- `lib/bot/signal-engine.ts` — add `reason: string` to `Signal` type; each strategy function builds the sentence
- `lib/bot/bot-runner.ts` — pass `signal.reason` to `executeTrade()`; build ATR stop reason inline
- `lib/trading-engine.ts` — add optional `reason` parameter to `executeTrade()`
- `app/api/history/route.ts` — include `reason` in trade select
- `components/history/trade-table.tsx` (or equivalent history component) — add "Reason" column

**New files:** none

**Unchanged:** position-sizer, regime-detector, indicators, market-data, sentiment

---

## Data Model

```prisma
model Trade {
  // ...existing fields...
  note      String?   // Raw signal dump (existing)
  reason    String?   // Human-readable explanation, bot-only, null for manual trades
}
```

Migration: single nullable column addition. No existing data is modified.

---

## Signal Type

```typescript
export interface Signal {
  symbol: string
  action: SignalAction
  conviction: number
  strategy: 'MOMENTUM' | 'MEAN_REVERSION' | 'BREAKOUT'
  regime: Regime
  reason: string   // empty string for HOLD
}
```

---

## Reason Format

### Momentum BUY
```
"Bought in a trending market — {trigger} and RSI was {rsi}. {weeklyClause}{sentimentClause}Conviction: {conviction}."
```

Where:
- `{trigger}` = `"MACD turned positive"` | `"price crossed above the 20 EMA"` | `"MACD turned positive and price crossed above the 20 EMA"`
- `{weeklyClause}` = `"Weekly trend was up. "` | `"Weekly trend was neutral. "` | `""` (omitted if no weekly candles)
- `{sentimentClause}` = `"Sentiment was bullish (+{score}). "` | `"Sentiment was bearish ({score}). "` | `""` (omitted if score in −0.3..+0.3)
- `{conviction}` = two decimal places, e.g. `0.71`

Example: *"Bought in a trending market — MACD turned positive and RSI was 58. Weekly trend was up. Sentiment was bullish (+0.62). Conviction: 0.71."*

### Mean Reversion BUY
```
"Bought near the lower Bollinger Band — RSI was {rsi} in a ranging market. {sentimentClause}Conviction: {conviction}."
```

Example: *"Bought near the lower Bollinger Band — RSI was 38 in a ranging market. Conviction: 0.55."*

### Breakout BUY
```
"Bought on a volatility breakout — price cleared the upper Bollinger Band on {volumeRatio}× average volume. ADX was {adx}. {sentimentClause}Conviction: {conviction}."
```

Example: *"Bought on a volatility breakout — price cleared the upper Bollinger Band on 2.1× average volume. ADX was 31. Conviction: 0.68."*

### Momentum SELL
```
"Sold — {reason}."
```
Where reason = `"price crossed below the 20 EMA"` | `"RSI hit {rsi} (overbought)"` | `"price crossed below the 20 EMA and RSI hit {rsi}"`

### Mean Reversion SELL
```
"Sold — {reason}."
```
Where reason = `"price reached the middle Bollinger Band"` | `"RSI hit {rsi} (overbought)"` | both

### Breakout SELL
```
"Sold — {reason}."
```
Where reason = `"price closed back inside Bollinger Bands"` | `"RSI hit {rsi} (overbought)"` | both

### ATR Stop Loss (built in bot-runner)
```
"Stop loss triggered at ${triggerPrice}."
```

---

## executeTrade Signature

```typescript
export async function executeTrade(
  accountId: string,
  symbol: string,
  assetType: AssetType,
  side: TradeSide,
  quantity: Decimal,
  price: Decimal,
  note?: string,
  reason?: string   // new optional parameter
): Promise<Trade>
```

---

## History Tab

The trade table adds a "Reason" column as the last column:
- Bot trades: displays the reason sentence
- Manual trades (reason is null): displays `—`
- Text truncates with ellipsis if too long; full text visible on hover via `title` attribute
- `/api/history` route includes `reason` in the Prisma select

---

## Testing

- Unit tests for each reason string format (one per strategy × BUY/SELL)
- ATR stop reason format
- Weekly gate clause inclusion/exclusion at boundary slopes (−0.002, +0.001)
- Sentiment clause inclusion/exclusion at boundary scores (−0.3, +0.3)
- `executeTrade` persists `reason` to DB
- History API returns `reason` field
