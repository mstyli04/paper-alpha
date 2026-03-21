import useSWR from 'swr'
import type { Quote } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useQuote(symbol: string, assetType: 'STOCK' | 'CRYPTO') {
  const { data, error, isLoading, mutate } = useSWR<Quote>(
    symbol ? `/api/market/quote?symbol=${symbol}&assetType=${assetType}` : null,
    fetcher,
    { refreshInterval: 15000 } // refresh every 15s
  )

  return { quote: data, error, isLoading, refresh: mutate }
}
