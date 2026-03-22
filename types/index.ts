export type AssetType = 'STOCK' | 'CRYPTO' | 'COMMODITY'
export type TradeSide = 'BUY' | 'SELL' | 'SHORT' | 'COVER'

export interface Quote {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  high: number
  low: number
  open: number
  previousClose: number
  volume: number
  marketCap?: number
  assetType: AssetType
  logoUrl?: string
  timestamp: number
}

export interface CandleData {
  time: number // Unix timestamp
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export interface SearchResult {
  symbol: string
  name: string
  assetType: AssetType
  logoUrl?: string
}

export interface Holding {
  id: string
  symbol: string
  assetType: AssetType
  quantity: number
  avgCostBasis: number
  realizedPnl: number
  currentPrice?: number
  currentValue?: number
  unrealizedPnl?: number
  unrealizedPnlPercent?: number
}

export interface Portfolio {
  cashBalance: number
  startingBalance: number
  holdings: Holding[]
  totalValue: number
  totalInvested: number
  unrealizedPnl: number
  realizedPnl: number
  totalPnl: number
  totalPnlPercent: number
  dailyPnl?: number
}

export interface TradeRecord {
  id: string
  symbol: string
  assetType: AssetType
  assetName: string
  side: TradeSide
  quantity: number
  price: number
  totalValue: number
  note: string | null
  createdAt: string
}

export interface LeaderboardEntry {
  rank: number
  userId: string
  username: string
  avatarUrl?: string
  totalValue: number
  startingBalance: number
  returnPercent: number
  totalPnl: number
}

export interface PortfolioSnapshot {
  totalValue: number
  cashBalance: number
  createdAt: string
}

export interface TrendingAsset {
  symbol: string
  name: string
  price: number
  changePercent: number
  assetType: AssetType
  logoUrl?: string
}
