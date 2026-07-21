import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import {
  TrendingUp,
  Zap,
  Trophy,
  ShieldCheck,
  BarChart3,
  Coins,
  ArrowRight,
} from 'lucide-react'
import { ThemeToggle } from '@/components/layout/theme-toggle'

const features = [
  {
    icon: Coins,
    title: '$100,000 Virtual Cash',
    desc: 'Start with a hundred grand in fake money. Trade stocks and crypto with zero real-world risk.',
  },
  {
    icon: TrendingUp,
    title: 'Live Market Prices',
    desc: 'All prices are sourced from real market data. Every trade executes at the current live price.',
  },
  {
    icon: BarChart3,
    title: 'Track Your P&L',
    desc: 'Monitor unrealized gains, realized profits, portfolio allocation, and performance over time.',
  },
  {
    icon: Trophy,
    title: 'Compete on Leaderboards',
    desc: 'Rank against other traders by return percentage. Weekly competitions coming soon.',
  },
  {
    icon: ShieldCheck,
    title: 'Zero Risk',
    desc: 'No real money, no brokerage accounts, no deposits. Just practice and learning.',
  },
  {
    icon: Zap,
    title: 'Instant Execution',
    desc: 'Market orders fill instantly at live prices. See your portfolio update in real time.',
  },
]

const tickers = [
  { symbol: 'AAPL', change: '+1.24%', up: true },
  { symbol: 'BTC', change: '-0.38%', up: false },
  { symbol: 'TSLA', change: '+2.05%', up: true },
  { symbol: 'ETH', change: '+0.91%', up: true },
  { symbol: 'NVDA', change: '-0.62%', up: false },
  { symbol: 'SOL', change: '+3.14%', up: true },
]

function LogoMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'md' ? 'w-7 h-7' : 'w-6 h-6'
  const glyph = size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'
  return (
    <div className={`${box} rounded-lg bg-brand flex items-center justify-center`}>
      <svg viewBox="0 0 16 16" className={`${glyph} fill-white`}>
        <rect x="2" y="9" width="3" height="5" rx="0.5" />
        <rect x="6.5" y="6" width="3" height="8" rx="0.5" />
        <rect x="11" y="2" width="3" height="12" rx="0.5" />
      </svg>
    </div>
  )
}

export default async function LandingPage() {
  const { userId } = await auth()
  if (userId) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-semibold text-text-primary text-[15px] tracking-tight">Paper Alpha</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/sign-in" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors px-3 py-1.5 rounded-lg hover:bg-surface-2">
              Sign in
            </Link>
            <Link href="/sign-up" className="btn-primary text-sm px-3 py-1.5">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Ticker strip */}
      <div className="border-b border-border bg-surface-2/40 overflow-x-auto">
        <div className="max-w-6xl mx-auto px-6 py-2 flex items-center gap-6 w-max">
          {tickers.map(({ symbol, change, up }) => (
            <span key={symbol} className="flex items-center gap-1.5 text-xs font-mono tabular-nums whitespace-nowrap">
              <span className="text-text-secondary">{symbol}</span>
              <span className={up ? 'text-green' : 'text-red'}>{change}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden py-20 px-6 md:py-28">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-hero-glow" />
        <div className="relative max-w-6xl mx-auto">
          <div className="max-w-2xl">
            <h1 className="text-5xl md:text-6xl font-semibold text-text-primary tracking-tighter text-balance mb-6">
              Trade the markets.
              <br />
              Risk nothing.
            </h1>

            <p className="text-lg text-text-secondary max-w-xl mb-8 leading-relaxed text-balance">
              Practice trading stocks and crypto with{' '}
              <span className="text-text-primary font-medium">$100,000 in virtual cash</span>.
              Real prices, real strategies, zero financial risk.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-3">
              <Link href="/sign-up" className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2">
                Start paper trading
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/sign-in" className="btn-secondary text-sm px-5 py-2.5">
                Sign in
              </Link>
            </div>

            <p className="text-xs text-text-muted mt-5">
              Free to use · Simulated environment only · Not financial advice
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <p className="text-[13px] font-medium text-brand mb-3">Features</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-text-primary mb-4">
              Everything you need to practice trading
            </h2>
            <p className="text-lg text-text-secondary">Built for beginners and experienced traders alike.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="card p-6">
                <div className="flex items-baseline gap-3 mb-4">
                  <span className="font-mono text-xs text-brand">{String(i + 1).padStart(2, '0')}</span>
                  <Icon className="w-5 h-5 text-text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="font-medium text-text-primary mb-2">{title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-6 bg-surface-2/50 border-y border-border">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { value: '$100,000', label: 'Starting virtual balance' },
            { value: '500+', label: 'Stocks & crypto assets' },
            { value: '15s', label: 'Price refresh interval' },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-3xl md:text-4xl font-semibold tracking-tight tabular-nums text-text-primary mb-2">{value}</p>
              <p className="text-xs text-text-muted">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-text-primary mb-4">
            Ready to start trading?
          </h2>
          <p className="text-lg text-text-secondary mb-8">
            Join and get $100,000 in virtual cash instantly. No credit card required.
          </p>
          <Link href="/sign-up" className="btn-primary text-sm px-5 py-2.5 inline-flex items-center gap-2">
            Create free account
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LogoMark size="sm" />
            <span className="text-sm font-semibold tracking-tight text-text-primary">Paper Alpha</span>
          </div>
          <p className="text-xs text-text-muted text-center">
            Paper Alpha is a simulated trading platform for educational purposes only. Not financial advice. No real money involved.
          </p>
          <Link href="/privacy" className="text-xs text-text-muted hover:text-text-primary transition-colors shrink-0">
            Privacy Policy
          </Link>
        </div>
      </footer>
    </div>
  )
}
