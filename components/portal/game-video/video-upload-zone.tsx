"use client"

import { useCallback, useRef, useState } from "react"
import { Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { UploadUiState } from "@/components/portal/game-video/game-video-types"
import { cn } from "@/lib/utils"
import { VIDEO_UPLOAD_ALLOWED_MIME, inferMimeFromFileName } from "@/lib/video/constants"
import { defaultDisplayTitleFromFileName } from "@/lib/video/upload-display-title"

const ACCEPT_ATTR = VIDEO_UPLOAD_ALLOWED_MIME.join(",")

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

export function validateClientVideoFile(file: File): string | null {
  if (!file || file.size <= 0) {
    return "Choose a non-empty video file."
  }
  const mime = (file.type && file.type.trim()) || inferMimeFromFileName(file.name) || ""
  if (!(VIDEO_UPLOAD_ALLOWED_MIME as readonly string[]).includes(mime)) {
    return "That file type isn’t supported. Use MP4, MOV, WebM, AVI, or MKV."
  }
  return null
}

type Props = {
  variant?: "hero" | "compact"
  filmRoom?: boolean
  canUpload: boolean
  uploadUi: UploadUiState | null
  onUpload: (file: File, coachTitle?: string) => void | Promise<void>
}

export function VideoUploadZone({
  variant = "hero",
  filmRoom = false,
  canUpload,
  uploadUi,
  onUpload,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [stagedFile, setStagedFile] = useState<File | null>(null)
  const [titleDraft, setTitleDraft] = useState("")
  const [dragDepth, setDragDepth] = useState(0)
  const [localError, setLocalError] = useState<string | null>(null)

  const busy =
    !!uploadUi &&
    (uploadUi.phase === "preparing" || uploadUi.phase === "uploading" || uploadUi.phase === "finalizing")

  const openPicker = useCallback(() => {
    setLocalError(null)
    inputRef.current?.click()
  }, [])

  const handleFileChosen = useCallback((file: File | undefined) => {
    if (!file) return
    const err = validateClientVideoFile(file)
    if (err) {
      setLocalError(err)
      setStagedFile(null)
      setTitleDraft("")
      return
    }
    setLocalError(null)
    setStagedFile(file)
    setTitleDraft(defaultDisplayTitleFromFileName(file.name))
  }, [])

  const clearStaged = useCallback(() => {
    setStagedFile(null)
    setTitleDraft("")
    setLocalError(null)
    if (inputRef.current) inputRef.current.value = ""
  }, [])

  const handleStartUpload = useCallback(async () => {
    if (!stagedFile || busy || !canUpload) return
    const err = validateClientVideoFile(stagedFile)
    if (err) {
      setLocalError(err)
      return
    }
    const trimmed = titleDraft.trim()
    const coachTitle = trimmed.length > 0 ? trimmed : undefined
    const file = stagedFile
    clearStaged()
    await onUpload(file, coachTitle)
  }, [stagedFile, busy, canUpload, titleDraft, onUpload, clearStaged])

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      e.target.value = ""
      handleFileChosen(f)
    },
    [handleFileChosen],
  )

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragDepth((d) => d + 1)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragDepth((d) => Math.max(0, d - 1))
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragDepth(0)
      const f = e.dataTransfer.files?.[0]
      handleFileChosen(f)
    },
    [handleFileChosen],
  )

  const dragActive = dragDepth > 0
  const isHero = variant === "hero"

  if (!canUpload) return null

  const progressPrimary =
    uploadUi?.displayTitle?.trim() ||
    (uploadUi?.fileName ? defaultDisplayTitleFromFileName(uploadUi.fileName) : "")

  return (
    <div className={cn("w-full", isHero ? "max-w-3xl" : "")}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={onInputChange}
      />

      {uploadUi && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 shadow-sm",
            filmRoom ? "border-white/15 bg-muted/40" : "border-border bg-card",
            !isHero && "mt-1",
          )}
        >
          <div className={cn("flex flex-wrap items-center justify-between gap-2 font-medium", isHero ? "text-base" : "text-sm")}>
            <div className="flex min-w-0 items-center gap-2">
              {uploadUi.phase === "success" ? (
                <span className="text-emerald-700 dark:text-emerald-400">Upload complete</span>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
                  <span className="text-foreground">{uploadPhaseLabel(uploadUi.phase)}</span>
                </>
              )}
            </div>
            <span className="font-mono tabular-nums text-muted-foreground">{uploadUi.pct}%</span>
          </div>
          <p
            className={cn(
              "mt-1 font-semibold text-foreground",
              isHero ? "text-base" : "text-xs",
              "line-clamp-2",
            )}
            title={progressPrimary}
          >
            {progressPrimary || uploadUi.fileName}
          </p>
          <p className={cn("mt-0.5 truncate text-muted-foreground", isHero ? "text-sm" : "text-[11px]")}>
            File: {uploadUi.fileName}
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-150 ease-out",
                uploadUi.phase === "success" ? "bg-emerald-600 dark:bg-emerald-500" : "bg-[#2563EB]",
              )}
              style={{ width: `${uploadUi.pct}%` }}
            />
          </div>
        </div>
      )}

      {!uploadUi && (
        <>
          {!stagedFile ? (
            <button
              type="button"
              disabled={busy}
              onClick={openPicker}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDragOver={onDragOver}
              onDrop={onDrop}
              aria-label={
                dragActive ? "Drop video here" : "Drag and drop game film or click to upload a video"
              }
              className={cn(
                "group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                isHero ? "min-h-[200px] gap-3 px-6 py-10 md:min-h-[220px]" : "min-h-[120px] gap-2 px-4 py-6",
                dragActive
                  ? "border-[#2563EB] bg-[#2563EB]/10 ring-2 ring-[#2563EB]/30"
                  : "border-border bg-muted/25 hover:border-[#2563EB]/60 hover:bg-muted/40",
                busy && "pointer-events-none opacity-60",
              )}
            >
              <Upload
                className={cn(
                  "text-primary",
                  isHero ? "h-12 w-12 md:h-14 md:w-14" : "h-8 w-8",
                  dragActive && "scale-105",
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "font-bold tracking-tight text-foreground",
                  isHero ? "text-lg md:text-xl" : "text-sm",
                )}
              >
                {dragActive ? "Drop video here" : "Drag and drop game film or click to upload"}
              </span>
              <span
                className={cn(
                  "max-w-md leading-relaxed text-muted-foreground",
                  isHero ? "text-base" : "text-xs",
                )}
              >
                MP4, MOV, WebM, AVI, or MKV · direct upload to your team library
              </span>
            </button>
          ) : (
            <div
              className={cn(
                "rounded-2xl border-2 border-border bg-card p-5 shadow-sm",
                filmRoom && "border-white/15 bg-muted/30",
              )}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1 space-y-2">
                  <p className={cn("font-semibold text-foreground", isHero ? "text-base" : "text-sm")}>
                    Selected file
                  </p>
                  <p className="truncate text-muted-foreground" title={stagedFile.name}>
                    {stagedFile.name}
                  </p>
                  <label className="block pt-2">
                    <span className={cn("font-semibold text-foreground", isHero ? "text-base" : "text-sm")}>
                      Film title <span className="font-normal text-muted-foreground">(optional)</span>
                    </span>
                    <Input
                      className={cn(
                        "mt-2 border-2 text-foreground",
                        isHero ? "min-h-[48px] text-base" : "min-h-[44px]",
                      )}
                      placeholder={defaultDisplayTitleFromFileName(stagedFile.name)}
                      value={titleDraft}
                      onChange={(e) => {
                        setTitleDraft(e.target.value)
                        setLocalError(null)
                      }}
                      disabled={busy}
                      autoComplete="off"
                    />
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Leave blank to use a cleaned version of the file name. Whitespace is trimmed.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 md:items-end">
                  <Button
                    type="button"
                    size={isHero ? "lg" : "default"}
                    className={cn(
                      "min-h-[48px] font-bold shadow-md",
                      isHero ? "w-full min-w-[200px] md:w-auto" : "w-full",
                      filmRoom
                        ? "border-2 border-[#1e40af] bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
                        : "bg-[#2563EB] text-white hover:bg-[#1d4ed8]",
                    )}
                    disabled={busy}
                    onClick={() => void handleStartUpload()}
                  >
                    Start upload
                  </Button>
                  <Button type="button" variant="outline" disabled={busy} onClick={clearStaged}>
                    Cancel
                  </Button>
                  <Button type="button" variant="ghost" className="text-primary" disabled={busy} onClick={openPicker}>
                    Choose different file
                  </Button>
                </div>
              </div>
            </div>
          )}

          {localError && (
            <div
              className={cn(
                "mt-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive",
              )}
              role="alert"
            >
              {localError}
            </div>
          )}
        </>
      )}
    </div>
  )
}
