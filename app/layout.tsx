import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { ClerkProvider } from '@clerk/nextjs'
import { ThemeProvider } from '@/components/layout/theme-provider'
import { SessionRecoveryBanner } from '@/components/layout/session-recovery-banner'
import './globals.css'

export const metadata: Metadata = {
  title: 'Paper Alpha — Practice Trading Platform',
  description: 'Trade stocks and crypto with $100,000 in virtual cash. Real prices, zero risk. Compete on leaderboards.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <ClerkProvider
      afterSignOutUrl="/"
      appearance={{
        variables: {
          colorPrimary: '#4f46e5',
          borderRadius: '0.625rem',
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          colorBackground: 'var(--surface)',
          colorForeground: 'var(--text-primary)',
          colorInput: 'var(--surface)',
          colorInputForeground: 'var(--text-primary)',
          colorPrimaryForeground: '#ffffff',
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <body className="bg-background text-text-primary antialiased">
          <ThemeProvider nonce={nonce}>
            {children}
            <SessionRecoveryBanner />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
