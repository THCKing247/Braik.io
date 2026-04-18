"use client"

import type { RefObject } from "react"
import { Film, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"
import type { GameVideoRow, UploadUiState } from "@/components/portal/game-video/game-video-types"
import { formatBytes } from "@/components/portal/game-video/format-bytes"
import { cn } from "@/lib/utils"

function uploadPhaseLabel(phase: UploadUiState["phase"]): string {
  switch (phase) {
    case "preparing":
      return "Preparing upload…"
    case "uploading":
      return "Uploading to storage…"
    case "finalizing":
      return "Finishing upload…"
    case "success":
      return "Upload complete"
    default:
      return "Working…"
  }
}

export function MediaLibraryRail({
  filmRoom = false,
  videos,
  loading,
  selectedId,
  onSelect,
  canUpload,
  uploadUi,
  fileInputRef,
  onPickUpload,
  onFileSelected,
}: {
  filmRoom?: boolean
  videos: GameVideoRow[]
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  canUpload: boolean
  uploadUi: UploadUiState | null
  fileInputRef: RefObject<HTMLInputElement>
  onPickUpload: () => void
  onFileSelected: (file: File) => void
}) {
  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col rounded-2xl border bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
        filmRoom
          ? "border-white/12 lg:sticky lg:top-0 lg:max-h-[calc(100dvh-11.5rem)] lg:self-start"
          : "border-border lg:sticky lg:top-6 lg:max-h-[calc(100vh-7rem)]",
      )}
    >
      <div className="border-b border-border px-4 py-5">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "rounded-xl p-2.5 text-primary",
              filmRoom ? "bg-sky-500/15 text-sky-600 dark:text-sky-400" : "bg-primary/10",
            )}
          >
            <Film className={cn("shrink-0", filmRoom ? "h-6 w-6" : "h-5 w-5")} aria-hidden />
          </div>
          <div>
            <h2 className={cn("font-bold tracking-tight text-foreground", filmRoom ? "text-base" : "text-sm font-semibold")}>
              Film library
            </h2>
            <p className={cn(filmRoom ? "text-[13px] text-slate-600 dark:text-slate-400" : "text-[11px] text-muted-foreground")}>
              {filmRoom ? "Games & practices on your team" : "Recent games · practices"}
            </p>
          </div>
        </div>
        {canUpload && (
          <div className="mt-5">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-matroska"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ""
                if (f) onFileSelected(f)
              }}
            />
            <Button
              type="button"
              variant="default"
              size={filmRoom ? "lg" : "sm"}
              className={cn(
                "w-full font-bold shadow-md",
                filmRoom && "h-12 min-h-[52px] border-2 border-[#1e40af] bg-[#2563EB] text-base text-white hover:bg-[#1d4ed8]",
              )}
              disabled={
                !!uploadUi &&
                (uploadUi.phase === "preparing" || uploadUi.phase === "uploading" || uploadUi.phase === "finalizing")
              }
              onClick={onPickUpload}
            >
              <Upload className={cn("mr-2 shrink-0", filmRoom ? "h-5 w-5" : "h-4 w-4")} aria-hidden />
              Upload video
            </Button>
          </div>
        )}
      </div>

      {uploadUi && (
        <div className="border-b border-border px-4 py-3">
          <div className={cn("flex flex-wrap items-center justify-between gap-2", filmRoom && "text-sm")}>
            <div className="flex min-w-0 items-center gap-2">
              {uploadUi.phase === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              ) : (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
              )}
              <span className="font-medium text-foreground">{uploadPhaseLabel(uploadUi.phase)}</span>
            </div>
            <span className="font-mono tabular-nums text-muted-foreground">{uploadUi.pct}%</span>
          </div>
          <p
            className={cn("mt-1 truncate text-muted-foreground", filmRoom ? "text-xs" : "text-[11px]")}
            title={uploadUi.fileName}
          >
            {uploadUi.fileName}
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-[width] duration-150 ease-out ${
                uploadUi.phase === "success" ? "bg-emerald-600 dark:bg-emerald-500" : "bg-[#2563EB]"
              }`}
              style={{ width: `${uploadUi.pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        {loading ? (
          <div className={cn("flex items-center justify-center gap-2 py-12 text-muted-foreground", filmRoom && "text-base")}>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : videos.length === 0 ? (
          <div
            className={cn(
              "rounded-xl border border-dashed px-4 py-10 text-center",
              filmRoom ? "border-white/15 bg-muted/30" : "border-border bg-muted/20",
            )}
          >
            <p className={cn("font-semibold text-foreground", filmRoom ? "text-base" : "text-sm")}>Nothing here yet</p>
            <p className={cn("mt-2 leading-relaxed text-muted-foreground", filmRoom ? "text-sm" : "text-xs")}>
              Upload video to start marking plays and saving clips.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {videos.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => onSelect(v.id)}
                  className={cn(
                    "flex w-full flex-col rounded-xl px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    filmRoom ? "min-h-[52px] justify-center py-3 text-[15px]" : "py-2.5 text-sm",
                    selectedId === v.id
                      ? "bg-primary/15 ring-2 ring-primary/40"
                      : "hover:bg-muted/60",
                  )}
                >
                  <span className="line-clamp-2 font-semibold leading-snug text-foreground">{v.title || "Untitled"}</span>
                  <span
                    className={cn(
                      "mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground",
                      filmRoom ? "text-[12px]" : "text-[10px]",
                    )}
                  >
                    {v.upload_status === "ready" ? (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-medium text-emerald-800 dark:text-emerald-200">
                        Ready
                      </span>
                    ) : (
                      <span>{v.upload_status}</span>
                    )}
                    {v.file_size_bytes != null && <span>{formatBytes(v.file_size_bytes)}</span>}
                    {v.duration_seconds != null && (
                      <span>{Math.round(v.duration_seconds)}s</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
