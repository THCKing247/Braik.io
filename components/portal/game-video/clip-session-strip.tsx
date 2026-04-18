"use client"

import { CheckCircle2, Film } from "lucide-react"
import type { ClipRow } from "@/components/portal/game-video/game-video-types"
import { formatMsRange } from "@/lib/video/timecode"
import { cn } from "@/lib/utils"

type Props = {
  clips: ClipRow[]
  /** Newest-first ids from the current review session */
  sessionOrder: string[]
  highlightClipId: string | null
  onSelectClip: (c: ClipRow) => void
}

export function ClipSessionStrip({ clips, sessionOrder, highlightClipId, onSelectClip }: Props) {
  const byId = new Map(clips.map((c) => [c.id, c]))
  const orderedNewestFirst = sessionOrder.map((id) => byId.get(id)).filter((c): c is ClipRow => Boolean(c))
  const chrono = [...orderedNewestFirst].reverse()

  if (chrono.length === 0) return null

  return (
    <div className="rounded-2xl border-2 border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3 shadow-sm ring-1 ring-emerald-500/10 dark:bg-emerald-950/20">
      <div className="flex flex-wrap items-center gap-2">
        <Film className="h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />
        <p className="text-sm font-bold text-foreground">
          This session: <span className="tabular-nums">{chrono.length}</span> clip{chrono.length === 1 ? "" : "s"}
        </p>
        <span className="text-xs text-muted-foreground">— tap to edit marks or metadata</span>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {chrono.map((c, idx) => {
          const active = highlightClipId === c.id
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelectClip(c)}
                className={cn(
                  "flex max-w-[min(100%,280px)] items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  active
                    ? "border-primary bg-primary/10 font-semibold text-foreground ring-1 ring-primary/30"
                    : "border-border bg-card hover:bg-muted/60",
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600/15 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                  {idx + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{c.title || "Clip"}</span>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
                  {formatMsRange(c.start_ms, c.end_ms)}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
