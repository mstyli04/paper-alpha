import useSWR from 'swr'
import type { Portfolio } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function usePortfolio() {
  const { data, error, isLoading, mutate } = useSWR<Portfolio>(
    '/api/portfolio',
    fetcher,
    { refreshInterval: 30000 }
  )

  return { portfolio: data, error, isLoading, refresh: mutate }
}
