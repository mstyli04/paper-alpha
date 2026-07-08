import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { SessionRecoveryBanner } from '@/components/layout/session-recovery-banner'
import './globals.css'

export const metadata: Metadata = {
  title: 'Paper Alpha — Practice Trading Platform',
  description: 'Trade stocks and crypto with $100,000 in virtual cash. Real prices, zero risk. Compete on leaderboards.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      afterSignOutUrl="/"
      appearance={{
        variables: {
          colorPrimary: '#22c55e',
          borderRadius: '0px',
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          colorBackground: 'var(--surface)',
          colorForeground: 'var(--text-primary)',
          colorInput: 'var(--surface-2)',
          colorInputForeground: 'var(--text-primary)',
          colorPrimaryForeground: '#0a0a0a',
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body className="bg-background text-text-primary antialiased">
          <ThemeProvider>
            {children}
            <SessionRecoveryBanner />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
