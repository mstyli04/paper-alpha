'use client'

import Image from 'next/image'
import { AVATAR_PRESETS, getPresetIndex, isPreset, isOwnerAvatar } from '@/lib/avatars'
import { cn } from '@/lib/utils'

interface AvatarDisplayProps {
  avatarUrl?: string | null
  username?: string
  size?: number
  className?: string
  isOwner?: boolean
}

// Pixel-art captain's hat SVG — owner-exclusive
function CaptainHatAvatar({ size, className }: { size: number; className?: string }) {
  return (
    <div
      className={cn('rounded-full flex items-center justify-center flex-shrink-0 border-2 border-yellow-400/60 overflow-hidden', className)}
      style={{ width: size, height: size, backgroundColor: '#0a1628' }}
    >
      <svg
        viewBox="0 0 32 32"
        width={size * 0.78}
        height={size * 0.78}
        shapeRendering="crispEdges"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Hat brim */}
        <rect x="4"  y="22" width="24" height="3" fill="#d4a017" />
        <rect x="3"  y="23" width="26" height="2" fill="#f5c842" />
        {/* Hat body */}
        <rect x="7"  y="10" width="18" height="13" fill="#0d2144" />
        {/* Hat top band (gold stripe) */}
        <rect x="7"  y="17" width="18" height="2"  fill="#d4a017" />
        {/* White top */}
        <rect x="7"  y="10" width="18" height="7"  fill="#1a3a6b" />
        {/* Anchor badge */}
        <rect x="14" y="12" width="4"  height="1"  fill="#f5c842" />
        <rect x="15" y="12" width="2"  height="4"  fill="#f5c842" />
        <rect x="14" y="15" width="4"  height="1"  fill="#f5c842" />
        <rect x="13" y="13" width="1"  height="1"  fill="#f5c842" />
        <rect x="18" y="13" width="1"  height="1"  fill="#f5c842" />
        <rect x="13" y="15" width="2"  height="1"  fill="#f5c842" />
        <rect x="17" y="15" width="2"  height="1"  fill="#f5c842" />
        {/* Brim highlight */}
        <rect x="3"  y="23" width="26" height="1"  fill="#ffe066" />
      </svg>
    </div>
  )
}

function AvatarInner({ avatarUrl, username, size = 40, className }: Omit<AvatarDisplayProps, 'isOwner'>) {
  if (isOwnerAvatar(avatarUrl)) {
    return <CaptainHatAvatar size={size} className={className} />
  }

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

export function AvatarDisplay({ avatarUrl, username, size = 40, className, isOwner }: AvatarDisplayProps) {
  if (!isOwner) {
    return <AvatarInner avatarUrl={avatarUrl} username={username} size={size} className={className} />
  }

  const crownSize = Math.max(12, Math.round(size * 0.38))

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <AvatarInner avatarUrl={avatarUrl} username={username} size={size} className={className} />
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
