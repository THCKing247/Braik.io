"use client"

import { useMemo } from "react"
import { Film, Lock, Users } from "lucide-react"
import type { ClipRow, GameVideoRow } from "@/components/portal/game-video/game-video-types"
import { DraftClipQueue } from "@/components/portal/game-video/draft-clip-queue"
import type { FilmDraftClip } from "@/components/portal/game-video/film-draft-types"
import { formatBytes } from "@/components/portal/game-video/format-bytes"
import { formatMsRange } from "@/lib/video/timecode"
import { cn } from "@/lib/utils"

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
        "hidden min-h-0 w-full max-w-[360px] shrink-0 flex-col gap-4 xl:flex",
        "xl:sticky xl:top-0 xl:max-h-[calc(100dvh-11.5rem)] xl:min-w-[280px] xl:overflow-y-auto xl:pr-1",
      )}
    >
      <div className="rounded-2xl border-2 border-white/10 bg-card/95 p-4 shadow-lg ring-1 ring-white/[0.06] backdrop-blur-sm dark:bg-[#0f172a]/90">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-xl bg-sky-500/15 p-2.5 text-sky-500">
            <Film className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">This film</p>
            <h2 className="mt-1 line-clamp-2 text-lg font-bold leading-snug tracking-tight text-foreground">
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
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Mark plays on the timeline, name them on the right panel, save when you are ready.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border-2 border-white/10 bg-card/90 p-3 shadow-md ring-1 ring-white/[0.05] dark:bg-[#0f172a]/85">
        <p className="text-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Session</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-muted/50 px-2 py-2">
            <div className="text-xl font-bold tabular-nums text-foreground">{draftQueue.drafts.length}</div>
            <div className="text-[11px] font-medium text-muted-foreground">Drafts</div>
          </div>
          <div className="rounded-xl bg-muted/50 px-2 py-2">
            <div className="text-xl font-bold tabular-nums text-foreground">{clips.length}</div>
            <div className="text-[11px] font-medium text-muted-foreground">Saved</div>
          </div>
          <div className="rounded-xl bg-muted/50 px-2 py-2">
            <div className="text-xl font-bold tabular-nums text-foreground">{sessionCount}</div>
            <div className="text-[11px] font-medium text-muted-foreground">This run</div>
          </div>
        </div>
      </div>

      {draftWorkflowEnabled ? (
        <DraftClipQueue {...draftQueue} />
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-white/15 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          {!videoReady
            ? "Draft marking opens when this film is ready to play. Refresh from the library if processing just finished."
            : !canCreateClips
              ? "You can review saved clips below; creating new drafts isn’t available for your role on this team."
              : "Draft queue unavailable."}
        </div>
      )}

      <div className="rounded-2xl border-2 border-white/10 bg-card/90 p-4 shadow-md ring-1 ring-white/[0.05] dark:bg-[#0f172a]/85">
        <h3 className="text-sm font-bold tracking-tight text-foreground">Saved on this film</h3>
        <p className="mt-1 text-xs text-muted-foreground">Open in the editor — details and tags stay in the right panel.</p>
        <ul className="mt-3 max-h-[min(280px,32vh)] space-y-1.5 overflow-y-auto pr-1">
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
