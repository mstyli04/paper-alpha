// lib/bot/universe.ts
import type { AssetType } from '@/types'

export interface UniverseAsset {
  symbol: string
  assetType: AssetType
  sector: 'TECH' | 'FINANCE' | 'HEALTH' | 'CONSUMER' | 'ENERGY' | 'COMMODITY' | 'CRYPTO'
}

export const UNIVERSE: UniverseAsset[] = [
  // Tech
  { symbol: 'AAPL',  assetType: 'STOCK', sector: 'TECH' },
  { symbol: 'MSFT',  assetType: 'STOCK', sector: 'TECH' },
  { symbol: 'NVDA',  assetType: 'STOCK', sector: 'TECH' },
  { symbol: 'GOOGL', assetType: 'STOCK', sector: 'TECH' },
  { symbol: 'META',  assetType: 'STOCK', sector: 'TECH' },
  { symbol: 'AMD',   assetType: 'STOCK', sector: 'TECH' },
  { symbol: 'ORCL',  assetType: 'STOCK', sector: 'TECH' },
  { symbol: 'CRM',   assetType: 'STOCK', sector: 'TECH' },
  { symbol: 'ADBE',  assetType: 'STOCK', sector: 'TECH' },
  { symbol: 'INTC',  assetType: 'STOCK', sector: 'TECH' },
  // Consumer
  { symbol: 'AMZN',  assetType: 'STOCK', sector: 'CONSUMER' },
  { symbol: 'TSLA',  assetType: 'STOCK', sector: 'CONSUMER' },
  { symbol: 'NFLX',  assetType: 'STOCK', sector: 'CONSUMER' },
  { symbol: 'DIS',   assetType: 'STOCK', sector: 'CONSUMER' },
  { symbol: 'NKE',   assetType: 'STOCK', sector: 'CONSUMER' },
  // Finance
  { symbol: 'JPM',   assetType: 'STOCK', sector: 'FINANCE' },
  { symbol: 'V',     assetType: 'STOCK', sector: 'FINANCE' },
  { symbol: 'GS',    assetType: 'STOCK', sector: 'FINANCE' },
  { symbol: 'BAC',   assetType: 'STOCK', sector: 'FINANCE' },
  { symbol: 'MA',    assetType: 'STOCK', sector: 'FINANCE' },
  // Health
  { symbol: 'UNH',   assetType: 'STOCK', sector: 'HEALTH' },
  { symbol: 'JNJ',   assetType: 'STOCK', sector: 'HEALTH' },
  { symbol: 'PFE',   assetType: 'STOCK', sector: 'HEALTH' },
  // Energy
  { symbol: 'XOM',   assetType: 'STOCK', sector: 'ENERGY' },
  { symbol: 'CVX',   assetType: 'STOCK', sector: 'ENERGY' },
  // Crypto
  { symbol: 'BTC',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'ETH',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'SOL',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'BNB',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'XRP',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'DOGE',  assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'ADA',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'AVAX',  assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'LINK',  assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'DOT',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'LTC',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  { symbol: 'UNI',   assetType: 'CRYPTO', sector: 'CRYPTO' },
  // Commodity ETFs (traded as STOCK via Finnhub)
  { symbol: 'GLD',   assetType: 'STOCK', sector: 'COMMODITY' },
  { symbol: 'SLV',   assetType: 'STOCK', sector: 'COMMODITY' },
  { symbol: 'USO',   assetType: 'STOCK', sector: 'COMMODITY' },
  { symbol: 'PDBC',  assetType: 'STOCK', sector: 'COMMODITY' },
  { symbol: 'CPER',  assetType: 'STOCK', sector: 'COMMODITY' },
]
