export interface AvatarPreset {
  emoji: string
  label: string
  bg: string
  color: string
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { emoji: '🐂', label: 'Bull',     bg: '#14532d', color: '#22c55e' },
  { emoji: '🐻', label: 'Bear',     bg: '#450a0a', color: '#ef4444' },
  { emoji: '🦈', label: 'Shark',    bg: '#0c1a45', color: '#3b82f6' },
  { emoji: '🦊', label: 'Fox',      bg: '#431407', color: '#f97316' },
  { emoji: '🐉', label: 'Dragon',   bg: '#2e1065', color: '#a855f7' },
  { emoji: '🦁', label: 'Lion',     bg: '#451a03', color: '#f59e0b' },
  { emoji: '🚀', label: 'Rocket',   bg: '#0c1a45', color: '#60a5fa' },
  { emoji: '💎', label: 'Diamond',  bg: '#083344', color: '#22d3ee' },
  { emoji: '🦅', label: 'Eagle',    bg: '#042f2e', color: '#14b8a6' },
  { emoji: '🐺', label: 'Wolf',     bg: '#1c1917', color: '#a8a29e' },
  { emoji: '⚡', label: 'Flash',    bg: '#422006', color: '#eab308' },
  { emoji: '🎯', label: 'Target',   bg: '#4a044e', color: '#e879f9' },
]

export const PRESET_PREFIX = 'preset:'
export const OWNER_AVATAR = 'preset:owner'
export const OWNER_USERNAME = 'mstyli'

export function isPreset(avatarUrl: string | null | undefined): boolean {
  return !!avatarUrl?.startsWith(PRESET_PREFIX)
}

export function isOwnerAvatar(avatarUrl: string | null | undefined): boolean {
  return avatarUrl === OWNER_AVATAR
}

export function getPresetIndex(avatarUrl: string | null | undefined): number {
  if (!isPreset(avatarUrl)) return -1
  const idx = parseInt(avatarUrl!.slice(PRESET_PREFIX.length), 10)
  return isNaN(idx) ? -1 : idx
}

export function presetUrl(index: number): string {
  return `${PRESET_PREFIX}${index}`
}
