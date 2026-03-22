'use client'

import Image from 'next/image'
import { AVATAR_PRESETS, getPresetIndex, isPreset } from '@/lib/avatars'
import { cn } from '@/lib/utils'

interface AvatarDisplayProps {
  avatarUrl?: string | null
  username?: string
  size?: number
  className?: string
}

export function AvatarDisplay({ avatarUrl, username, size = 40, className }: AvatarDisplayProps) {
  if (isPreset(avatarUrl)) {
    const idx = getPresetIndex(avatarUrl)
    const preset = AVATAR_PRESETS[idx]
    if (preset) {
      return (
        <div
          className={cn('rounded-full flex items-center justify-center flex-shrink-0 border-2 border-border', className)}
          style={{ width: size, height: size, backgroundColor: preset.bg }}
        >
          <span style={{ fontSize: size * 0.5 }} role="img" aria-label={preset.label}>
            {preset.emoji}
          </span>
        </div>
      )
    }
  }

  if (avatarUrl && !isPreset(avatarUrl)) {
    return (
      <Image
        src={avatarUrl}
        alt={username ?? 'avatar'}
        width={size}
        height={size}
        className={cn('rounded-full border-2 border-border flex-shrink-0 object-cover', className)}
      />
    )
  }

  // Fallback: initial letter
  return (
    <div
      className={cn('rounded-full bg-surface-2 border-2 border-border flex items-center justify-center flex-shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <span className="font-bold text-text-secondary" style={{ fontSize: size * 0.38 }}>
        {username?.[0]?.toUpperCase() ?? '?'}
      </span>
    </div>
  )
}
