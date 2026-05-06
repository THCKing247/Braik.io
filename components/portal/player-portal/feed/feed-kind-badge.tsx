"use client"

import type { PlayerFeedPostKind } from "@/components/portal/player-portal/feed/player-feed-types"
import { cn } from "@/lib/utils"

const LABELS: Record<PlayerFeedPostKind, string> = {
  coach_announcement: "Announcement",
  team_update: "Update",
  game_result: "Result",
  coach_video: "Film",
  highlight: "Highlight",
}

const STYLES: Partial<Record<PlayerFeedPostKind, string>> = {
  coach_announcement: "bg-[#F85808]/20 text-[#F8F8E8] ring-[#F85808]/40",
  team_update: "bg-[#081848]/60 text-[#F8F8F8] ring-[#1f2f63]/80",
  game_result: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/35",
  coach_video: "bg-[#081848]/60 text-[#F8F8F8] ring-[#1f2f63]/80",
  highlight: "bg-[#D83808]/20 text-[#F8F8E8] ring-[#D83808]/40",
}

export function FeedKindBadge({
  kind,
  className,
}: {
  kind: PlayerFeedPostKind
  className?: string
}) {
  const style =
    STYLES[kind] ?? "bg-slate-500/15 text-slate-200 ring-slate-400/30"
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset",
        style,
        className
      )}
    >
      {LABELS[kind]}
    </span>
  )
}
