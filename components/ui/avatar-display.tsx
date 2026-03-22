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
// White cap, black brim, gold band, gold anchor badge (based on classic sailor captain style)
function CaptainHatAvatar({ size, className }: { size: number; className?: string }) {
  return (
    <div
      className={cn('rounded-full flex items-center justify-center flex-shrink-0 border-2 border-yellow-400/60 overflow-hidden', className)}
      style={{ width: size, height: size, backgroundColor: '#1a2540' }}
    >
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        shapeRendering="crispEdges"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* White hat crown — dome shape */}
        <rect x="13" y="5"  width="6"  height="1" fill="#f0f0f0" />
        <rect x="11" y="6"  width="10" height="1" fill="#f0f0f0" />
        <rect x="9"  y="7"  width="14" height="8" fill="#f0f0f0" />
        {/* Subtle shadow at base of crown */}
        <rect x="9"  y="15" width="14" height="1" fill="#d8d8dc" />
        {/* Gold band */}
        <rect x="9"  y="16" width="14" height="1" fill="#f5c842" />
        <rect x="9"  y="17" width="14" height="1" fill="#c9a227" />
        {/* Black brim */}
        <rect x="7"  y="18" width="18" height="1" fill="#2a2a2a" />
        <rect x="5"  y="19" width="22" height="2" fill="#111111" />
        <rect x="7"  y="21" width="18" height="1" fill="#222222" />
        {/* Gold anchor badge — centered on white crown */}
        {/* Ring at top of anchor */}
        <rect x="15" y="7"  width="2"  height="1" fill="#c9a227" />
        {/* Vertical stem */}
        <rect x="16" y="7"  width="1"  height="7" fill="#c9a227" />
        {/* Horizontal crossbar */}
        <rect x="13" y="9"  width="6"  height="1" fill="#c9a227" />
        {/* Crossbar end dots */}
        <rect x="12" y="9"  width="1"  height="1" fill="#c9a227" />
        <rect x="19" y="9"  width="1"  height="1" fill="#c9a227" />
        {/* Bottom flukes */}
        <rect x="13" y="13" width="2"  height="1" fill="#c9a227" />
        <rect x="17" y="13" width="2"  height="1" fill="#c9a227" />
        <rect x="14" y="14" width="4"  height="1" fill="#c9a227" />
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
