"use client"

import type { RefObject } from "react"
import { Film, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CheckCircle2 } from "lucide-react"
import type { GameVideoRow, UploadUiState } from "@/components/portal/game-video/game-video-types"
import { formatBytes } from "@/components/portal/game-video/format-bytes"

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
    <aside className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06] lg:sticky lg:top-6 lg:max-h-[calc(100vh-7rem)]">
      <div className="border-b border-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Film className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Your film</h2>
            <p className="text-[11px] text-muted-foreground">Recent games · practices</p>
          </div>
        </div>
        {canUpload && (
          <div className="mt-4">
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
              size="sm"
              className="w-full"
              disabled={
                !!uploadUi &&
                (uploadUi.phase === "preparing" || uploadUi.phase === "uploading" || uploadUi.phase === "finalizing")
              }
              onClick={onPickUpload}
            >
              <Upload className="mr-2 h-4 w-4" aria-hidden />
              Add film
            </Button>
          </div>
        )}
      </div>

      {uploadUi && (
        <div className="border-b border-border px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
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
          <p className="mt-1 truncate text-[11px] text-muted-foreground" title={uploadUi.fileName}>
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
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : videos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">Nothing here yet</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Add a game or practice so you can mark plays and save teaching clips.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {videos.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => onSelect(v.id)}
                  className={`flex w-full flex-col rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                    selectedId === v.id
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : "hover:bg-muted/60"
                  }`}
                >
                  <span className="line-clamp-2 font-medium leading-snug text-foreground">{v.title || "Untitled"}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
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
