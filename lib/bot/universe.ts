// lib/bot/universe.ts
import type { AssetType } from '@/types'

export interface UniverseAsset {
  symbol: string
  assetType: AssetType
  sector: 'TECH' | 'FINANCE' | 'HEALTH' | 'CONSUMER' | 'COMMODITY' | 'CRYPTO'
}

export const UNIVERSE: UniverseAsset[] = [
  // Stocks
  { symbol: 'AAPL',  assetType: 'STOCK', sector: 'TECH' },
  { symbol: 'MSFT',  assetType: 'STOCK', sector: 'TECH' },
  { symbol: 'NVDA',  assetType: 'STOCK', sector: 'TECH' },
  { symbol: 'GOOGL', assetType: 'STOCK', sector: 'TECH' },
  { symbol: 'AMZN',  assetType: 'STOCK', sector: 'CONSUMER' },
  { symbol: 'META',  assetType: 'STOCK', sector: 'TECH' },
  { symbol: 'TSLA',  assetType: 'STOCK', sector: 'CONSUMER' },
  { symbol: 'JPM',   assetType: 'STOCK', sector: 'FINANCE' },
  { symbol: 'V',     assetType: 'STOCK', sector: 'FINANCE' },
  { symbol: 'UNH',   assetType: 'STOCK', sector: 'HEALTH' },
  // Crypto
  { symbol: 'BTC',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'ETH',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'SOL',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'BNB',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'XRP',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'DOGE',  assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'ADA',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'AVAX',  assetType: 'CRYPTO', sector: 'CRYPTO' },
  // Commodity ETFs (traded as STOCK via Finnhub)
  { symbol: 'GLD',   assetType: 'STOCK', sector: 'COMMODITY' },
  { symbol: 'SLV',   assetType: 'STOCK', sector: 'COMMODITY' },
  { symbol: 'USO',   assetType: 'STOCK', sector: 'COMMODITY' },
  { symbol: 'PDBC',  assetType: 'STOCK', sector: 'COMMODITY' },
]
