export interface Achievement {
  id: string
  title: string
  description: string
  emoji: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
}

export interface EarnedAchievement extends Achievement {
  earned: boolean
  earnedAt?: string
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_trade',
    title: 'First Blood',
    description: 'Execute your very first trade',
    emoji: '🎯',
    rarity: 'common',
  },
  {
    id: 'ten_trades',
    title: 'Active Trader',
    description: 'Execute 10 trades',
    emoji: '⚡',
    rarity: 'common',
  },
  {
    id: 'fifty_trades',
    title: 'Power Trader',
    description: 'Execute 50 trades',
    emoji: '🔥',
    rarity: 'rare',
  },
  {
    id: 'hundred_trades',
    title: 'Century Club',
    description: 'Execute 100 trades',
    emoji: '💯',
    rarity: 'epic',
  },
  {
    id: 'in_profit',
    title: 'In the Green',
    description: 'Achieve a positive total return',
    emoji: '📈',
    rarity: 'common',
  },
  {
    id: 'five_percent',
    title: '5% Club',
    description: 'Achieve a 5% total return',
    emoji: '🌱',
    rarity: 'rare',
  },
  {
    id: 'ten_percent',
    title: 'Double Digits',
    description: 'Achieve a 10% total return',
    emoji: '🚀',
    rarity: 'rare',
  },
  {
    id: 'fifty_percent',
    title: 'Half Bagger',
    description: 'Achieve a 50% total return',
    emoji: '💰',
    rarity: 'epic',
  },
  {
    id: 'doubled',
    title: '2x Legend',
    description: 'Double your starting balance',
    emoji: '🏆',
    rarity: 'legendary',
  },
  {
    id: 'diversified',
    title: 'Diversified',
    description: 'Hold 5 or more different assets at once',
    emoji: '🌍',
    rarity: 'common',
  },
  {
    id: 'short_seller',
    title: 'Bear Mode',
    description: 'Open your first short position',
    emoji: '🐻',
    rarity: 'rare',
  },
  {
    id: 'profitable_short',
    title: 'Bear Hunter',
    description: 'Close a short position at a profit',
    emoji: '🏹',
    rarity: 'epic',
  },
  {
    id: 'whale',
    title: 'Whale',
    description: 'Grow your portfolio to $150,000',
    emoji: '🐳',
    rarity: 'legendary',
  },
  {
    id: 'beat_market',
    title: 'Market Beater',
    description: 'Outperform the S&P 500 (5%+ return)',
    emoji: '👑',
    rarity: 'epic',
  },
]

export const RARITY_STYLES: Record<Achievement['rarity'], { border: string; badge: string; glow: string }> = {
  common:    { border: 'border-border',          badge: 'bg-surface-2 text-text-muted',          glow: '' },
  rare:      { border: 'border-blue-500/40',     badge: 'bg-blue-500/10 text-blue-400',          glow: 'shadow-blue-500/10' },
  epic:      { border: 'border-purple-500/40',   badge: 'bg-purple-500/10 text-purple-400',      glow: 'shadow-purple-500/10' },
  legendary: { border: 'border-yellow-400/50',   badge: 'bg-yellow-400/10 text-yellow-400',      glow: 'shadow-yellow-400/10' },
}
