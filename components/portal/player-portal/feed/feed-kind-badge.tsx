"use client"

import type { PlayerFeedPostKind } from "@/components/portal/player-portal/feed/player-feed-types"
import { cn } from "@/lib/utils"

const CONFIG: Record<
  PlayerFeedPostKind,
  { label: string; style: string }
> = {
  coach_announcement: {
    label: "📌 Pinned",
    style: "bg-[rgba(255,198,61,0.16)] text-[#FFC63D] border border-[rgba(255,198,61,0.35)]",
  },
  team_update: {
    label: "Playbook",
    style: "bg-[rgba(255,122,51,0.14)] text-[#FF7A33] border border-[rgba(255,122,51,0.35)]",
  },
  game_result: {
    label: "Final",
    style: "bg-[rgba(43,213,118,0.14)] text-[#2BD576] border border-[rgba(43,213,118,0.35)]",
  },
  coach_video: {
    label: "Film",
    style: "bg-[rgba(77,155,255,0.14)] text-[#4D9BFF] border border-[rgba(77,155,255,0.35)]",
  },
  highlight: {
    label: "Highlight",
    style: "bg-[rgba(255,122,51,0.14)] text-[#FF7A33] border border-[rgba(255,122,51,0.35)]",
  },
}

export function FeedKindBadge({
  kind,
  pinned,
  className,
}: {
  kind: PlayerFeedPostKind
  pinned?: boolean
  className?: string
}) {
  const cfg = pinned
    ? { label: "📌 Pinned", style: CONFIG.coach_announcement.style }
    : CONFIG[kind]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[6px] px-[7px] py-[3px] text-[8.5px] font-black uppercase tracking-[0.09em]",
        cfg.style,
        className
      )}
    >
      {cfg.label}
    </span>
  )
}
