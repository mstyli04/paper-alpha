'use client'

import { useUser } from '@clerk/nextjs'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'

export default function ProfileRedirect() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (!isLoaded) return

    // Try Clerk username first
    if (user?.username) {
      router.replace(`/profile/${user.username}`)
      return
    }

    // Fall back to DB username (Clerk username may not be set)
    if (!tried) {
      setTried(true)
      fetch('/api/user')
        .then(r => r.json())
        .then(data => {
          if (data?.username) {
            router.replace(`/profile/${data.username}`)
          }
        })
        .catch(() => {})
    }
  }, [isLoaded, user, router, tried])

  return (
    <div className="space-y-4 animate-fade-in">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    </div>
  )
}
