import useSWR from 'swr'
import type { Quote } from '@/types'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Failed to fetch quote')
  return data
}

export function useQuote(symbol: string, assetType: 'STOCK' | 'CRYPTO' | 'COMMODITY' | 'PREDICTION') {
  const { data, error, isLoading } = useSWR<Quote>(
    `/api/market/quote?symbol=${symbol}&assetType=${assetType}`,
    fetcher,
    { refreshInterval: 15000 }
  )
  return { quote: data, isLoading, error }
}
