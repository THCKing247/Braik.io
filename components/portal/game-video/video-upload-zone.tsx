"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import type { FilmUploadMeta, UploadUiState } from "@/components/portal/game-video/game-video-types"
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

function parseTagsInput(raw: string): string[] | undefined {
  const parts = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 24)
  return parts.length > 0 ? parts : undefined
}

type Props = {
  variant?: "hero" | "compact"
  filmRoom?: boolean
  canUpload: boolean
  taggingEnabled?: boolean
  uploadUi: UploadUiState | null
  onUpload: (file: File, meta: FilmUploadMeta) => void | Promise<void>
}

export function VideoUploadZone({
  variant = "hero",
  filmRoom = false,
  canUpload,
  taggingEnabled = false,
  uploadUi,
  onUpload,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const [stagedFile, setStagedFile] = useState<File | null>(null)
  const [titleDraft, setTitleDraft] = useState("")
  const [tagsDraft, setTagsDraft] = useState("")
  const [opponent, setOpponent] = useState("")
  const [category, setCategory] = useState("")
  const [gameDate, setGameDate] = useState("")
  const [isPrivate, setIsPrivate] = useState(false)
  const [dragDepth, setDragDepth] = useState(0)
  const [localError, setLocalError] = useState<string | null>(null)

  const busy =
    !!uploadUi &&
    (uploadUi.phase === "preparing" || uploadUi.phase === "uploading" || uploadUi.phase === "finalizing")

  const openPicker = useCallback(() => {
    setLocalError(null)
    inputRef.current?.click()
  }, [])

  const resetSideFields = useCallback(() => {
    setTagsDraft("")
    setOpponent("")
    setCategory("")
    setGameDate("")
    setIsPrivate(false)
  }, [])

  const handleFileChosen = useCallback(
    (file: File | undefined) => {
      if (!file) return
      const err = validateClientVideoFile(file)
      if (err) {
        setLocalError(err)
        setStagedFile(null)
        setTitleDraft("")
        resetSideFields()
        return
      }
      setLocalError(null)
      setStagedFile(file)
      setTitleDraft(defaultDisplayTitleFromFileName(file.name))
      resetSideFields()
    },
    [resetSideFields],
  )

  const clearStaged = useCallback(() => {
    setStagedFile(null)
    setTitleDraft("")
    resetSideFields()
    setLocalError(null)
    if (inputRef.current) inputRef.current.value = ""
  }, [resetSideFields])

  useEffect(() => {
    if (stagedFile && !busy) {
      requestAnimationFrame(() => titleInputRef.current?.focus())
    }
  }, [stagedFile, busy])

  const buildMeta = useCallback((): FilmUploadMeta => {
    const trimmedTitle = titleDraft.trim()
    const tags = taggingEnabled ? parseTagsInput(tagsDraft) : undefined
    const opp = opponent.trim()
    const cat = category.trim()
    const gd = gameDate.trim()
    return {
      ...(trimmedTitle.length > 0 ? { title: trimmedTitle } : {}),
      isPrivate,
      ...(tags ? { tags } : {}),
      ...(opp ? { opponent: opp } : {}),
      ...(cat ? { category: cat } : {}),
      ...(gd ? { gameDate: gd } : {}),
    }
  }, [titleDraft, isPrivate, tagsDraft, opponent, category, gameDate, taggingEnabled])

  const handleStartUpload = useCallback(async () => {
    if (!stagedFile || busy || !canUpload) return
    const err = validateClientVideoFile(stagedFile)
    if (err) {
      setLocalError(err)
      return
    }
    const file = stagedFile
    const meta = buildMeta()
    clearStaged()
    await onUpload(file, meta)
  }, [stagedFile, busy, canUpload, buildMeta, onUpload, clearStaged])

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

  const progressCard = uploadUi ? (
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
        className={cn("mt-1 font-semibold text-foreground", isHero ? "text-base" : "text-xs", "line-clamp-2")}
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
  ) : null

  const fileSummaryPanel = stagedFile ? (
    <div className="flex min-h-[200px] flex-col justify-center gap-5 rounded-2xl border-2 border-primary/20 bg-primary/[0.05] p-6 md:min-h-[240px] md:p-8">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Video file</p>
        <p className="mt-2 break-all font-mono text-sm font-semibold leading-snug text-foreground">{stagedFile.name}</p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Fill in display title and options on the right, then start upload. You remain on this page — no need to re-select the
          film between steps.
        </p>
      </div>
      <Button type="button" variant="outline" className="h-12 w-full shrink-0 font-semibold sm:max-w-xs" onClick={openPicker}>
        Choose different file
      </Button>
    </div>
  ) : null

  const dropZoneButton = (
    <button
      type="button"
      disabled={busy}
      onClick={openPicker}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      aria-label={dragActive ? "Drop video here" : "Drag and drop game film or click to upload a video"}
      className={cn(
        "group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        isHero ? "min-h-[200px] gap-3 px-5 py-8 lg:min-h-[240px]" : "min-h-[120px] gap-2 px-4 py-6",
        dragActive
          ? "border-[#2563EB] bg-[#2563EB]/10 ring-2 ring-[#2563EB]/30"
          : "border-border bg-muted/25 hover:border-[#2563EB]/60 hover:bg-muted/40",
        busy && "pointer-events-none opacity-60",
      )}
    >
      <Upload
        className={cn(
          "text-primary",
          isHero ? "h-11 w-11 md:h-12 md:w-12" : "h-8 w-8",
          dragActive && "scale-105",
        )}
        aria-hidden
      />
      <span className={cn("font-bold tracking-tight text-foreground", isHero ? "text-lg md:text-xl" : "text-sm")}>
        {dragActive ? "Drop video here" : "Drag and drop game film or click to upload"}
      </span>
      <span className={cn("max-w-sm leading-relaxed text-muted-foreground", isHero ? "text-sm md:text-base" : "text-xs")}>
        MP4, MOV, WebM, AVI, or MKV · direct upload to your team library
      </span>
    </button>
  )

  const metadataPanel = (
    <div
      className={cn(
        "flex flex-col",
        isHero ? "min-h-[200px] lg:min-h-[240px]" : "",
        filmRoom ? "bg-muted/25" : "bg-muted/30",
      )}
    >
      <div className="border-b border-border px-5 py-3 md:px-6">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Upload details</p>
        <p className="mt-1 text-sm font-semibold text-foreground">Name & organize this film</p>
      </div>

      <div className="flex flex-1 flex-col gap-4 px-5 py-4 md:px-6">
        {!stagedFile ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Drop a file on the left or click to browse. You’ll set the display title, privacy, and optional labels before
            upload starts.
          </p>
        ) : (
          <>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-foreground">Video title</label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Shown in your film library. Leave blank to use a cleaned file name.
              </p>
              <Input
                ref={titleInputRef}
                className="mt-2 min-h-[48px] border-2 text-base font-medium text-foreground"
                placeholder={defaultDisplayTitleFromFileName(stagedFile.name)}
                value={titleDraft}
                onChange={(e) => {
                  setTitleDraft(e.target.value)
                  setLocalError(null)
                }}
                disabled={busy}
                autoComplete="off"
              />
            </div>

            {taggingEnabled && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-foreground">Tags</label>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Comma-separated — for search and filters.</p>
                <Input
                  className="mt-2 min-h-[44px] border-2 text-foreground"
                  placeholder="e.g. varsity, red zone, week 3"
                  value={tagsDraft}
                  onChange={(e) => setTagsDraft(e.target.value)}
                  disabled={busy}
                />
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-foreground">Opponent</label>
                <Input
                  className="mt-2 min-h-[44px] border-2 text-foreground"
                  placeholder="Optional"
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-foreground">Category</label>
                <Input
                  className="mt-2 min-h-[44px] border-2 text-foreground"
                  placeholder="Game, practice, scout…"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-foreground">Film date</label>
              <Input
                type="date"
                className="mt-2 min-h-[44px] border-2 text-foreground"
                value={gameDate}
                onChange={(e) => setGameDate(e.target.value)}
                disabled={busy}
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background/80 px-4 py-3">
              <Checkbox
                checked={isPrivate}
                disabled={busy}
                onCheckedChange={(c) => setIsPrivate(c === true)}
                className="mt-1"
                aria-label="Private (hide from recruiters)"
              />
              <span className="text-sm leading-snug text-foreground">
                <span className="font-bold">Private (hide from recruiters)</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Hidden from public recruiting profiles until you change this later in the library.
                </span>
              </span>
            </label>

            <p className="truncate text-xs text-muted-foreground" title={stagedFile.name}>
              <span className="font-semibold text-foreground">File:</span> {stagedFile.name}
            </p>

            <div className="mt-auto flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                size="lg"
                className={cn(
                  "min-h-[48px] flex-1 font-bold shadow-md",
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
            </div>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className={cn("w-full", isHero ? "max-w-none" : "")}>
      <input ref={inputRef} type="file" accept={ACCEPT_ATTR} className="hidden" onChange={onInputChange} />

      {progressCard}

      {!uploadUi && (
        <>
          <div
            className={cn(
              "overflow-hidden rounded-2xl border-2 shadow-md ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
              filmRoom ? "border-white/12 bg-card/80" : "border-border bg-card",
            )}
          >
            {isHero ? (
              <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,1fr)] lg:items-stretch">
                <div className="p-5 md:p-6 lg:border-r lg:border-border">
                  {stagedFile ? fileSummaryPanel : dropZoneButton}
                </div>
                <div className="border-t border-border lg:border-t-0">{metadataPanel}</div>
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="p-4">{stagedFile ? fileSummaryPanel : dropZoneButton}</div>
                <div className="border-t border-border">{metadataPanel}</div>
              </div>
            )}
          </div>

          {localError && (
            <div
              className="mt-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive"
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
