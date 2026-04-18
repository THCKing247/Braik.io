"use client"

import { useMemo } from "react"
import { Film, Lock, PanelLeftClose, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ClipRow, GameVideoRow } from "@/components/portal/game-video/game-video-types"
import { DraftClipQueue } from "@/components/portal/game-video/draft-clip-queue"
import type { FilmDraftClip } from "@/components/portal/game-video/film-draft-types"
import { formatBytes } from "@/components/portal/game-video/format-bytes"
import { formatMsRange } from "@/lib/video/timecode"
import { cn } from "@/lib/utils"
import { FilmInfoTip } from "@/components/portal/game-video/film-info-tip"

type DraftQueueProps = {
  drafts: FilmDraftClip[]
  selectedId: string | null
  pulseDraftId: string | null
  bulkSelectedIds: Set<string>
  markPhase: "idle" | "await_end"
  pendingStartMs: number | null
  onSelect: (id: string) => void
  onToggleBulk: (id: string, checked: boolean) => void
  onTitleChange: (id: string, title: string) => void
  onRemove: (id: string) => void
  onDiscardOpenMark: () => void
  disabled?: boolean
}

type Props = {
  video: GameVideoRow
  clips: ClipRow[]
  sessionClipIds: string[]
  filmAttachedPlayerIds: string[]
  highlightClipId: string | null
  canCreateClips: boolean
  videoReady: boolean
  draftWorkflowEnabled: boolean
  draftQueue: DraftQueueProps
  onLoadSavedClip: (c: ClipRow) => void
  /** Hide this rail to give the player more horizontal space (desktop). */
  onRequestCollapse?: () => void
}

export function FilmRoomSessionRail({
  video,
  clips,
  sessionClipIds,
  filmAttachedPlayerIds,
  highlightClipId,
  canCreateClips,
  videoReady,
  draftWorkflowEnabled,
  draftQueue,
  onLoadSavedClip,
  onRequestCollapse,
}: Props) {
  const sortedSaved = useMemo(() => {
    return [...clips].sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : 0
      const tb = b.created_at ? Date.parse(b.created_at) : 0
      return tb - ta
    })
  }, [clips])

  const sessionCount = sessionClipIds.length
  const linkedPlayers = filmAttachedPlayerIds.length

  return (
    <aside
      className={cn(
        "hidden min-h-0 w-full shrink-0 flex-col gap-2 xl:flex xl:w-[212px] xl:max-w-[220px]",
        "xl:sticky xl:top-2 xl:max-h-[calc(100dvh-7.5rem)] xl:overflow-y-auto xl:overflow-x-hidden xl:pr-0.5",
      )}
    >
      <div className="rounded-lg border border-white/10 bg-card/95 p-2.5 shadow-sm ring-1 ring-white/[0.04] backdrop-blur-sm dark:bg-[#0f172a]/90">
        <div className="flex items-start gap-2">
          <div className="shrink-0 rounded-lg bg-sky-500/15 p-2 text-sky-500">
            <Film className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">This film</p>
            <h2 className="mt-0.5 line-clamp-2 text-[15px] font-bold leading-snug tracking-tight text-foreground">
              {video.title || "Untitled film"}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {video.upload_status === "ready" ? (
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-800 dark:text-emerald-200">
                  Ready
                </span>
              ) : (
                <span className="rounded-md bg-amber-500/15 px-2 py-0.5 font-medium text-amber-900 dark:text-amber-100">
                  {video.upload_status ?? "Processing"}
                </span>
              )}
              {video.is_private ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-500/15 px-2 py-0.5 font-medium text-foreground">
                  <Lock className="h-3.5 w-3.5" aria-hidden />
                  Private
                </span>
              ) : (
                <span className="rounded-md bg-slate-500/10 px-2 py-0.5">Recruiting visible</span>
              )}
              {video.duration_seconds != null && (
                <span className="tabular-nums">{Math.round(video.duration_seconds)}s</span>
              )}
              {video.file_size_bytes != null && <span>{formatBytes(video.file_size_bytes)}</span>}
            </div>
            {linkedPlayers > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {linkedPlayers} athlete{linkedPlayers === 1 ? "" : "s"} linked to full film
              </p>
            )}
          </div>
          {onRequestCollapse ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={onRequestCollapse}
              aria-label="Hide list and widen player"
            >
              <PanelLeftClose className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-card/90 p-2.5 shadow-sm ring-1 ring-white/[0.05] dark:bg-[#0f172a]/85">
        <p className="text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Session</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-lg bg-muted/50 px-1.5 py-1.5">
            <div className="text-lg font-bold tabular-nums leading-tight text-foreground">{draftQueue.drafts.length}</div>
            <div className="text-[10px] font-medium text-muted-foreground">Drafts</div>
          </div>
          <div className="rounded-lg bg-muted/50 px-1.5 py-1.5">
            <div className="text-lg font-bold tabular-nums leading-tight text-foreground">{clips.length}</div>
            <div className="text-[10px] font-medium text-muted-foreground">Saved</div>
          </div>
          <div className="rounded-lg bg-muted/50 px-1.5 py-1.5">
            <div className="text-lg font-bold tabular-nums leading-tight text-foreground">{sessionCount}</div>
            <div className="text-[10px] font-medium text-muted-foreground">Run</div>
          </div>
        </div>
      </div>

      {draftWorkflowEnabled ? (
        <DraftClipQueue {...draftQueue} />
      ) : (
        <div className="rounded-xl border border-dashed border-white/15 bg-muted/20 px-3 py-5 text-center text-xs text-muted-foreground">
          {!videoReady
            ? "Draft marking opens when this film is ready to play. Refresh from the library if processing just finished."
            : !canCreateClips
              ? "You can review saved clips below; creating new drafts isn’t available for your role on this team."
              : "Draft queue unavailable."}
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-card/90 p-3 shadow-sm ring-1 ring-white/[0.05] dark:bg-[#0f172a]/85">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold tracking-tight text-foreground">Saved clips</h3>
          <FilmInfoTip label="Saved clips on this film">
            <p>
              Opens the clip in the workspace. Coaching notes and tags stay in the right-hand panel — this list is for quick recall.
            </p>
          </FilmInfoTip>
        </div>
        <ul className="mt-2 max-h-[min(220px,28vh)] space-y-1 overflow-y-auto pr-0.5">
          {sortedSaved.length === 0 ? (
            <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              No clips saved yet for this film.
            </li>
          ) : (
            sortedSaved.map((c) => {
              const active = highlightClipId === c.id
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onLoadSavedClip(c)}
                    className={cn(
                      "flex w-full flex-col rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      active ? "bg-primary/15 ring-2 ring-primary/35" : "hover:bg-muted/60",
                    )}
                  >
                    <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                      {c.title?.trim() || "Untitled clip"}
                    </span>
                    <span className="mt-1 font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                      {formatMsRange(c.start_ms, c.end_ms)}
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </aside>
  )
}
