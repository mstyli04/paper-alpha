import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'Paper Alpha — Practice Trading Platform',
  description: 'Trade stocks and crypto with $100,000 in virtual cash. Real prices, zero risk. Compete on leaderboards.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body className="bg-background text-text-primary antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
