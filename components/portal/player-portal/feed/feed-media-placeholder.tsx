"use client"

import type { PlayerFeedPost } from "@/components/portal/player-portal/feed/player-feed-types"
import { cn } from "@/lib/utils"

const PRESETS: Record<
  NonNullable<PlayerFeedPost["mediaPlaceholder"]>,
  { bg: string; emoji?: string; hasPlay?: boolean; duration?: string }
> = {
  film: {
    bg: "radial-gradient(340px 200px at 20% 0%, rgba(77,155,255,0.4), transparent 60%), linear-gradient(135deg,#123A78,#081431)",
    hasPlay: true,
    duration: "4:32",
  },
  locker: {
    bg: "radial-gradient(340px 200px at 80% 100%, rgba(255,122,51,0.35), transparent 60%), linear-gradient(135deg,#1A3468,#0A1531)",
    emoji: "🚌",
  },
  practice: {
    bg: "radial-gradient(300px 190px at 15% 10%, rgba(255,198,61,0.28), transparent 55%), linear-gradient(135deg,#8C3A0E,#4A1A05)",
    emoji: "📋",
  },
  stadium: {
    bg: "radial-gradient(420px 220px at 50% 120%, rgba(43,213,118,0.22), transparent 65%), linear-gradient(135deg,#0F2B66,#081231)",
    hasPlay: true,
    duration: "2:18",
  },
  field: {
    bg: "radial-gradient(340px 200px at 50% 0%, rgba(43,213,118,0.28), transparent 55%), linear-gradient(135deg,#0B3A1E,#061A0D)",
    hasPlay: true,
    duration: "1:04",
  },
  crowd: {
    bg: "radial-gradient(340px 200px at 80% 0%, rgba(255,122,51,0.35), transparent 60%), linear-gradient(135deg,#6A2800,#2A0E00)",
    hasPlay: true,
    duration: "0:55",
  },
}

export function FeedMediaPlaceholder({
  variant,
  className,
}: {
  variant?: PlayerFeedPost["mediaPlaceholder"]
  className?: string
}) {
  const key = variant ?? "practice"
  const preset = PRESETS[key]

  return (
    <div
      className={cn(
        "relative h-[190px] cursor-pointer overflow-hidden rounded-[16px] border border-white/[0.07]",
        "flex items-center justify-center",
        className
      )}
      style={{ background: preset.bg }}
      aria-hidden
    >
      {preset.emoji ? (
        <span className="text-[52px]" style={{ filter: "drop-shadow(0 8px 18px rgba(0,0,0,0.45))" }}>
          {preset.emoji}
        </span>
      ) : null}

      {preset.hasPlay ? (
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.28] bg-[rgba(3,8,26,0.55)] backdrop-blur-[6px] transition-transform hover:scale-[1.08]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white ml-0.5">
            <polygon points="6 3 21 12 6 21" />
          </svg>
        </div>
      ) : null}

      {preset.duration ? (
        <span className="absolute bottom-[10px] right-[10px] rounded-[7px] bg-[rgba(3,8,26,0.7)] px-[8px] py-[4px] text-[10px] font-bold text-white">
          {preset.duration}
        </span>
      ) : null}
    </div>
  )
}
