"use client"

import { Clapperboard, Film, Scissors } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ClipRow, GameVideoRow } from "@/components/portal/game-video/game-video-types"
import { FilmFullRosterLinksCard } from "@/components/portal/game-video/film-full-roster-links-card"
import { formatMsRange } from "@/lib/video/timecode"
import { cn } from "@/lib/utils"

export function FilmRoomExperienceToggle({
  mode,
  onModeChange,
  canEdit,
  disabled,
}: {
  mode: "review" | "edit"
  onModeChange: (m: "review" | "edit") => void
  canEdit: boolean
  disabled?: boolean
}) {
  if (!canEdit) return null
  const segmentActive =
    "bg-sky-500 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-sky-500 hover:text-white disabled:opacity-55"
  const segmentIdle =
    "bg-transparent text-slate-200 hover:bg-white/10 hover:text-white disabled:text-slate-500 disabled:hover:bg-transparent"
  return (
    <div
      className="inline-flex max-w-full shrink-0 rounded-md border border-white/20 bg-[#070d18] p-px shadow-inner"
      role="group"
      aria-label="Film Room mode"
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={disabled}
        className={cn(
          "h-8 shrink-0 gap-1 rounded-[5px] px-2.5 text-[11px] font-semibold tracking-tight sm:h-8 sm:text-[12px]",
          mode === "review" ? segmentActive : segmentIdle,
        )}
        onClick={() => onModeChange("review")}
      >
        <Film className="h-3.5 w-3.5 shrink-0 opacity-95" aria-hidden />
        Review
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={disabled}
        title="Edit clips — capture workflow"
        className={cn(
          "h-8 shrink-0 gap-1 rounded-[5px] px-2.5 text-[11px] font-semibold tracking-tight sm:h-8 sm:text-[12px]",
          mode === "edit" ? segmentActive : segmentIdle,
        )}
        onClick={() => onModeChange("edit")}
      >
        <Scissors className="h-3.5 w-3.5 shrink-0 opacity-95" aria-hidden />
        <span className="hidden min-[340px]:inline">Edit clips</span>
        <span className="min-[340px]:hidden">Edit</span>
      </Button>
    </div>
  )
}

export function FilmRoomReviewSidebar({
  video,
  clipsSorted,
  highlightClipId,
  sessionClipCount,
  onLoadClip,
  onPreviewClip,
  teamId,
  filmAttachedPlayerIds,
  onFilmAttachedPlayerIdsChange,
  filmRosterDisabled,
  modeControls,
}: {
  video: GameVideoRow
  clipsSorted: ClipRow[]
  highlightClipId: string | null
  sessionClipCount: number
  onLoadClip: (c: ClipRow) => void
  onPreviewClip: (c: ClipRow) => void
  teamId: string
  filmAttachedPlayerIds: string[]
  onFilmAttachedPlayerIdsChange?: (ids: string[]) => Promise<void>
  filmRosterDisabled: boolean
  modeControls?: React.ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      {modeControls}

      <div className="shrink-0 rounded-md border border-white/15 bg-[#0b1220]/95 px-2 py-1.5 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-sky-300">Film</p>
        <p className="truncate text-[15px] font-bold leading-snug text-white">{video.title || "Untitled film"}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-medium text-slate-200">
          <span>
            Clips: <strong className="font-semibold text-white">{clipsSorted.length}</strong>
          </span>
          <span>
            This session: <strong className="font-semibold text-white">{sessionClipCount}</strong>
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden rounded-md border border-white/15 bg-[#0f172a]/95 p-1.5 shadow-sm">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <h3 className="text-[13px] font-bold text-white">Saved clips</h3>
          <span className="text-[12px] font-medium text-slate-300">{clipsSorted.length} total</span>
        </div>
        <p className="shrink-0 text-[12px] leading-snug text-slate-300">
          Open a clip to coach it, or preview to play the clip range on the timeline.
        </p>
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
          {clipsSorted.length === 0 ? (
            <li className="rounded-lg border border-dashed border-white/15 px-3 py-8 text-center text-[13px] font-medium text-slate-300">
              No clips yet. Switch to <strong className="text-white">Edit clips</strong> to capture plays.
            </li>
          ) : (
            clipsSorted.map((c) => {
              const active = highlightClipId === c.id
              return (
                <li key={c.id}>
                  <div
                    className={cn(
                      "flex flex-col gap-1.5 rounded-lg border px-2 py-2 transition-colors",
                      active ? "border-sky-500/50 bg-sky-950/40" : "border-white/10 bg-[#0b1220]/80 hover:border-white/20",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onLoadClip(c)}
                      className="flex w-full flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-white">
                        {c.title?.trim() || "Untitled clip"}
                      </span>
                      <span className="mt-0.5 font-mono text-[12px] font-medium tabular-nums text-slate-300">
                        {formatMsRange(c.start_ms, c.end_ms)}
                      </span>
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-8 w-full border border-blue-900/60 bg-blue-700 text-[13px] font-semibold text-white hover:bg-blue-600"
                      onClick={() => onPreviewClip(c)}
                    >
                      <Clapperboard className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Preview clip
                    </Button>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      </div>

      {onFilmAttachedPlayerIdsChange ? (
        <FilmFullRosterLinksCard
          teamId={teamId}
          filmAttachedPlayerIds={filmAttachedPlayerIds}
          onFilmAttachedPlayerIdsChange={onFilmAttachedPlayerIdsChange}
          disabled={filmRosterDisabled}
        />
      ) : null}
    </div>
  )
}
