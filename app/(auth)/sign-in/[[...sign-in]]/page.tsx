import { SignIn } from '@clerk/nextjs'
import { Zap } from 'lucide-react'
import Link from 'next/link'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <Link href="/" className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-text-primary text-lg">Paper Alpha</span>
      </Link>
      <SignIn />
      <p className="mt-6 text-xs text-text-muted">
        <Link href="/privacy" className="text-text-muted hover:text-text-primary transition-colors">Privacy Policy</Link>
      </p>
    </div>
  )
}
