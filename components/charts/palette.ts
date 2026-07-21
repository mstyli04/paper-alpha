'use client'

import { useTheme } from 'next-themes'

// Navy Ledger + Gold Signal chart palette.
// Red is reserved for loss/sell semantics and must never appear in CATEGORICAL.
export const SIGNAL = { up: '#16a34a', down: '#dc2626' } as const

export const CATEGORICAL = {
  dark: ['#c9974a', '#8c9bb0', '#e0b876', '#5a6779', '#f2dfb0', '#2c3a4d'],
  light: ['#a97b38', '#52596b', '#c9974a', '#8a90a0', '#dcb877', '#d4cfc0'],
} as const

export const CHART_CHROME = {
  dark: { grid: '#1c2433', text: '#8c9bb0', border: '#1c2433' },
  light: { grid: '#e2ddd0', text: '#52596b', border: '#e2ddd0' },
} as const

export function useChartPalette() {
  const { resolvedTheme } = useTheme()
  // resolvedTheme is undefined during SSR/first paint; dark is the app default.
  const mode: 'dark' | 'light' = resolvedTheme === 'light' ? 'light' : 'dark'
  return {
    mode,
    categorical: [...CATEGORICAL[mode]],
    chrome: CHART_CHROME[mode],
    signal: SIGNAL,
  }
}
