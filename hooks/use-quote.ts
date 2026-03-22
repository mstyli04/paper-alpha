import useSWR from 'swr'
import type { Quote } from '@/types'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export function useQuote(symbol: string, assetType: 'STOCK' | 'CRYPTO' | 'COMMODITY') {
  const { data, error, isLoading } = useSWR<Quote>(
    `/api/market/quote?symbol=${symbol}&assetType=${assetType}`,
    fetcher,
    { refreshInterval: 15000 }
  )
  return { quote: data, isLoading, error }
}
