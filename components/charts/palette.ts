'use client'

import { useTheme } from 'next-themes'

// Minimal zinc + indigo chart palette (matches DESIGN.md restyle).
// Red is reserved for loss/sell semantics and must never appear in CATEGORICAL.
export const SIGNAL = { up: '#16a34a', down: '#dc2626' } as const

export const CATEGORICAL = {
  dark: ['#6366f1', '#a1a1aa', '#818cf8', '#71717a', '#c7d2fe', '#3f3f46'],
  light: ['#4f46e5', '#52525b', '#818cf8', '#a1a1aa', '#a5b4fc', '#d4d4d8'],
} as const

export const CHART_CHROME = {
  dark: { grid: '#27272a', text: '#a1a1aa', border: '#27272a' },
  light: { grid: '#e4e4e7', text: '#52525b', border: '#e4e4e7' },
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
