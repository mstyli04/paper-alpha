'use client'

import { useTheme } from 'next-themes'

// Brutalist Ledger chart palette (spec: 2026-07-07-brutalist-phase2-design.md).
// Red is reserved for loss/sell semantics and must never appear in CATEGORICAL.
export const SIGNAL = { up: '#22c55e', down: '#ef4444' } as const

export const CATEGORICAL = {
  dark: ['#22c55e', '#16a34a', '#ffffff', '#a3a3a3', '#525252', '#2a2a2a'],
  light: ['#22c55e', '#16a34a', '#0a0a0a', '#525252', '#a3a3a3', '#d4d4d4'],
} as const

export const CHART_CHROME = {
  dark: { grid: '#2a2a2a', text: '#a3a3a3', border: '#ffffff' },
  light: { grid: '#d4d4d4', text: '#525252', border: '#0a0a0a' },
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
