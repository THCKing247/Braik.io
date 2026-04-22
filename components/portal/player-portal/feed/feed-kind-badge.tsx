"use client"

import type { PlayerFeedPostKind } from "@/components/portal/player-portal/feed/player-feed-types"
import { cn } from "@/lib/utils"

const LABELS: Record<PlayerFeedPostKind, string> = {
  announcement: "Update",
  image: "Photo",
  game_day: "Game day",
  highlight: "Highlight",
  media_clip: "Film",
  schedule: "Schedule",
  pinned_reminder: "Pinned",
  playbook_teaser: "Playbook",
  study_teaser: "Study",
  motivation: "Team",
}

const STYLES: Partial<Record<PlayerFeedPostKind, string>> = {
  announcement: "bg-sky-500/15 text-sky-800 ring-sky-500/30",
  game_day: "bg-emerald-500/15 text-emerald-800 ring-emerald-500/30",
  highlight: "bg-amber-500/20 text-amber-900 ring-amber-500/35",
  pinned_reminder: "bg-amber-500/25 text-amber-950 ring-amber-500/40",
  playbook_teaser: "bg-orange-500/15 text-orange-900 ring-orange-500/30",
  study_teaser: "bg-sky-500/12 text-sky-900 ring-sky-500/25",
  motivation: "bg-gradient-to-r from-orange-500/20 to-rose-500/20 text-orange-900 ring-orange-500/30",
  image: "bg-amber-500/12 text-amber-900 ring-amber-500/25",
  media_clip: "bg-orange-500/12 text-orange-900 ring-orange-500/25",
  schedule: "bg-cyan-500/12 text-cyan-900 ring-cyan-500/25",
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
