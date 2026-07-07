import Link from 'next/link'
import {
  TrendingUp,
  Zap,
  Trophy,
  ShieldCheck,
  BarChart3,
  Coins,
  ArrowRight,
} from 'lucide-react'

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

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b-2 border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand border-2 border-border flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#0a0a0a]" />
            </div>
            <span className="font-bold text-text-primary text-lg uppercase tracking-tight">Paper Alpha</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in" className="text-sm font-bold uppercase tracking-wide text-text-secondary hover:text-text-primary transition-colors px-4 py-2">
              Sign In
            </Link>
            <Link href="/sign-up" className="btn-primary text-sm">
              Start Trading Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-brand text-[#0a0a0a] text-xs font-bold uppercase tracking-wide px-3 py-1.5 border-2 border-border mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a] animate-pulse-slow" />
            Live market data · No real money required
          </div>

          <h1 className="text-5xl md:text-6xl font-bold uppercase text-text-primary leading-tight mb-6 tracking-tight">
            Trade the Markets.
            <br />
            <span className="text-brand">Risk Nothing.</span>
          </h1>

          <p className="text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
            Practice trading stocks and crypto with{' '}
            <span className="text-text-primary font-medium">$100,000 in virtual cash</span>.
            Real prices, real strategies, zero financial risk.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up" className="btn-primary text-base px-8 py-3 flex items-center gap-2">
              Start Paper Trading
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/sign-in" className="btn-secondary text-base px-8 py-3">
              Sign In
            </Link>
          </div>

          <p className="text-xs text-text-muted mt-6">
            Free to use · Simulated environment only · Not financial advice
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 border-t-2 border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold uppercase text-text-primary mb-3">Everything you need to practice trading</h2>
            <p className="text-text-secondary">Built for beginners and experienced traders alike.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card p-6 hover:bg-surface-2 transition-colors">
                <div className="w-10 h-10 border-2 border-border flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-brand" />
                </div>
                <h3 className="font-bold text-text-primary mb-2">{title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-6 bg-surface border-y-2 border-border">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { value: '$100,000', label: 'Starting virtual balance' },
            { value: '500+', label: 'Stocks & crypto assets' },
            { value: '15s', label: 'Price refresh interval' },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-3xl font-bold font-mono tabular-nums text-text-primary mb-1">{value}</p>
              <p className="text-sm text-text-muted">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold uppercase text-text-primary mb-4">Ready to start trading?</h2>
          <p className="text-text-secondary mb-8">Join and get $100,000 in virtual cash instantly. No credit card required.</p>
          <Link href="/sign-up" className="btn-primary text-base px-8 py-3 inline-flex items-center gap-2">
            Create Free Account
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-brand border-2 border-border flex items-center justify-center">
              <Zap className="w-3 h-3 text-[#0a0a0a]" />
            </div>
            <span className="text-sm font-bold uppercase text-text-primary">Paper Alpha</span>
          </div>
          <p className="text-xs text-text-muted text-center">
            Paper Alpha is a simulated trading platform for educational purposes only. Not financial advice. No real money involved.
          </p>
        </div>
      </footer>
    </div>
  )
}
