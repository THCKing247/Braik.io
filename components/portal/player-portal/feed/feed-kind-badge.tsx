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
  coach_announcement: "bg-sky-500/15 text-sky-800 ring-sky-500/30",
  team_update: "bg-violet-500/15 text-violet-900 ring-violet-500/30",
  game_result: "bg-emerald-500/15 text-emerald-800 ring-emerald-500/30",
  coach_video: "bg-orange-500/12 text-orange-900 ring-orange-500/25",
  highlight: "bg-amber-500/20 text-amber-900 ring-amber-500/35",
}

export function FeedKindBadge({
  kind,
  className,
}: {
  kind: PlayerFeedPostKind
  className?: string
}) {
  const style =
    STYLES[kind] ?? "bg-slate-500/10 text-slate-700 ring-slate-400/20"
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
