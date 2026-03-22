'use client'

import Image from 'next/image'
import { AVATAR_PRESETS, getPresetIndex, isPreset } from '@/lib/avatars'
import { cn } from '@/lib/utils'

interface AvatarDisplayProps {
  avatarUrl?: string | null
  username?: string
  size?: number
  className?: string
  isOwner?: boolean
}

function AvatarInner({ avatarUrl, username, size, className }: Omit<AvatarDisplayProps, 'isOwner'>) {
  if (isPreset(avatarUrl)) {
    const idx = getPresetIndex(avatarUrl)
    const preset = AVATAR_PRESETS[idx]
    if (preset) {
      return (
        <div
          className={cn('rounded-full flex items-center justify-center flex-shrink-0 border-2 border-border', className)}
          style={{ width: size, height: size, backgroundColor: preset.bg }}
        >
          <span style={{ fontSize: (size ?? 40) * 0.5 }} role="img" aria-label={preset.label}>
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

  return (
    <div
      className={cn('rounded-full bg-surface-2 border-2 border-border flex items-center justify-center flex-shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <span className="font-bold text-text-secondary" style={{ fontSize: (size ?? 40) * 0.38 }}>
        {username?.[0]?.toUpperCase() ?? '?'}
      </span>
    </div>
  )
}

export function AvatarDisplay({ avatarUrl, username, size = 40, className, isOwner }: AvatarDisplayProps) {
  if (!isOwner) {
    return <AvatarInner avatarUrl={avatarUrl} username={username} size={size} className={className} />
  }

  const crownSize = Math.max(12, Math.round(size * 0.38))

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <AvatarInner avatarUrl={avatarUrl} username={username} size={size} className={className} />
      {/* Crown positioned above the avatar */}
      <span
        className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-sm select-none pointer-events-none"
        style={{ fontSize: crownSize }}
        title="Owner"
      >
        👑
      </span>
    </div>
  )
}
