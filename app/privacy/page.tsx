import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy — Paper Alpha',
  description: 'How Paper Alpha collects, uses, and protects your data.',
}

const CONTACT_EMAIL = 'michael.stylianou7@gmail.com'

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold tracking-tight text-text-primary mt-10 mb-3">{children}</h2>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-text-secondary leading-relaxed mb-3">{children}</p>
}

function LI({ children }: { children: React.ReactNode }) {
  return <li className="text-sm text-text-secondary leading-relaxed">{children}</li>
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center">
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-white">
                <path d="M1 12.5 6 7l3 3 6-6.5V9h-2V7.9L9 12.3 6 9.3l-3.6 4L1 12.5Z" />
              </svg>
            </span>
            <span className="font-semibold text-text-primary text-[15px] tracking-tight">Paper Alpha</span>
          </Link>
          <Link href="/" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
            ← Back to home
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">Privacy Policy</h1>
        <p className="text-sm text-text-muted mt-2">Last updated: 18 July 2026</p>

        <P>
          Paper Alpha is a simulated trading platform for educational purposes. No real money is
          involved. This policy explains what data we collect, why, and the rights you have over
          it under the EU/UK General Data Protection Regulation (GDPR).
        </P>

        <H2>Who is responsible</H2>
        <P>
          Paper Alpha is operated by Michael Stylianou (the &ldquo;data controller&rdquo;). For any
          privacy question or request, contact{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand hover:underline">{CONTACT_EMAIL}</a>.
        </P>

        <H2>What we collect</H2>
        <ul className="list-disc pl-5 space-y-1.5 mb-3">
          <LI>
            <span className="text-text-primary font-medium">Account data</span> — email address,
            username, and an optional avatar, provided when you sign up through our authentication
            provider, Clerk.
          </LI>
          <LI>
            <span className="text-text-primary font-medium">Activity data</span> — your simulated
            trades, holdings, watchlists, price alerts, and portfolio history. This is fictional
            trading data; it involves no real financial information.
          </LI>
        </ul>
        <P>
          We do not collect payment details, government identifiers, precise location, or any
          special-category data, and we do not run advertising or third-party analytics trackers.
        </P>

        <H2>Why we process it</H2>
        <P>
          We process account and activity data to provide the service you signed up for
          (Art. 6(1)(b) GDPR) — authentication, running your paper portfolio, and showing
          leaderboards — and to keep the service secure and prevent abuse (Art. 6(1)(f),
          legitimate interest).
        </P>

        <H2>What other users can see</H2>
        <P>
          Your username, avatar, portfolio performance, and trade history are visible to other
          signed-in users on the leaderboard, activity feed, and your public profile. Your email
          address is never shown to anyone. If you prefer not to be identifiable, choose a
          username that doesn&rsquo;t reveal who you are — you can change it anytime in Settings.
        </P>

        <H2>Cookies</H2>
        <P>
          We use only strictly necessary cookies: the session cookies our authentication provider
          (Clerk) needs to keep you signed in. We set no advertising, analytics, or tracking
          cookies, which is why there is no cookie consent banner.
        </P>

        <H2>Who processes data on our behalf</H2>
        <ul className="list-disc pl-5 space-y-1.5 mb-3">
          <LI><span className="text-text-primary font-medium">Clerk</span> — authentication and account management.</LI>
          <LI><span className="text-text-primary font-medium">Vercel</span> — application hosting.</LI>
          <LI><span className="text-text-primary font-medium">Our managed PostgreSQL provider</span> — database hosting.</LI>
        </ul>
        <P>
          Market data providers (e.g. Yahoo Finance, CoinGecko) and Anthropic (for AI market
          commentary) receive only ticker symbols and market data — never your personal data.
          Some processors operate in the United States; transfers rely on their standard
          contractual clauses and/or EU–US Data Privacy Framework certification.
        </P>

        <H2>How long we keep it</H2>
        <P>
          We keep your data for as long as your account exists. When your account is deleted, all
          of it — profile, trades, holdings, snapshots, alerts, and watchlists — is permanently
          removed from our database immediately.
        </P>

        <H2>Your rights</H2>
        <ul className="list-disc pl-5 space-y-1.5 mb-3">
          <LI><span className="text-text-primary font-medium">Access &amp; portability</span> — download everything we hold about you as JSON from Settings → Privacy &amp; Data.</LI>
          <LI><span className="text-text-primary font-medium">Rectification</span> — change your username and avatar in Settings; manage your email through your account provider.</LI>
          <LI><span className="text-text-primary font-medium">Erasure</span> — delete your account and all associated data from Settings → Privacy &amp; Data. Deletion is immediate and irreversible.</LI>
          <LI><span className="text-text-primary font-medium">Objection &amp; complaint</span> — contact us at the address above, or lodge a complaint with your supervisory authority (in the UK, the ICO).</LI>
        </ul>

        <H2>Changes</H2>
        <P>
          If this policy changes materially, we will update the date at the top of this page.
        </P>
      </main>

      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-text-muted">
            Paper Alpha is a simulated trading platform for educational purposes only. Not financial advice.
          </p>
          <Link href="/privacy" className="text-xs text-text-muted hover:text-text-primary transition-colors">
            Privacy Policy
          </Link>
        </div>
      </footer>
    </div>
  )
}
