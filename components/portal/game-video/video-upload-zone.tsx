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
  /** hero = film room marketing size; compact = rail/modal; library = two-column library header; library-inline = compact toolbar strip */
  variant?: "hero" | "compact" | "library" | "library-inline"
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
  const isLibrary = variant === "library"
  const isLibraryInline = variant === "library-inline"
  const metaCompact = isLibrary || isLibraryInline

  if (!canUpload) return null

  const progressPrimary =
    uploadUi?.displayTitle?.trim() ||
    (uploadUi?.fileName ? defaultDisplayTitleFromFileName(uploadUi.fileName) : "")

  const progressCard = uploadUi ? (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 shadow-sm",
        filmRoom ? "border-white/15 bg-muted/40" : "border-border bg-card",
        !isHero && !isLibrary && !isLibraryInline && "mt-1",
        metaCompact && "py-2.5",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 font-medium",
          isHero ? "text-base" : "text-sm",
          metaCompact && "text-sm",
        )}
      >
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
          metaCompact && !isLibraryInline && "text-sm",
          isLibraryInline && "text-xs",
          "line-clamp-2",
        )}
        title={progressPrimary}
      >
        {progressPrimary || uploadUi.fileName}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-muted-foreground",
          isHero ? "text-sm" : "text-[11px]",
          metaCompact && "text-[11px]",
        )}
      >
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
    <div
      className={cn(
        "flex flex-col justify-center rounded-2xl border-2 border-primary/20 bg-primary/[0.05]",
        isHero && "min-h-[200px] gap-5 p-6 md:min-h-[240px] md:p-8",
        isLibrary && "gap-3 p-4",
        isLibraryInline && "gap-2 p-3",
        !isHero && !isLibrary && !isLibraryInline && "min-h-[140px] gap-4 p-5 md:min-h-[160px]",
      )}
    >
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Video file</p>
        <p className="mt-1.5 break-all font-mono text-xs font-semibold leading-snug text-foreground sm:text-sm">
          {stagedFile.name}
        </p>
        {!metaCompact && (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Fill in display title and options on the right, then start upload. You remain on this page — no need to re-select the
            film between steps.
          </p>
        )}
        {isLibrary && !isLibraryInline && (
          <p className="mt-2 text-xs leading-snug text-muted-foreground">
            Add title and options on the right, then start upload.
          </p>
        )}
        {isLibraryInline && (
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">Set title and fields below, then start upload.</p>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        className={cn("w-full shrink-0 font-semibold sm:max-w-xs", metaCompact ? "h-9 text-sm" : "h-12")}
        onClick={openPicker}
      >
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
        isHero ? "min-h-[200px] gap-3 px-5 py-8 lg:min-h-[240px]" : "",
        isLibrary ? "min-h-[92px] gap-1.5 px-3 py-4" : "",
        !isHero && !isLibrary ? "min-h-[120px] gap-2 px-4 py-6" : "",
        dragActive
          ? "border-[#2563EB] bg-[#2563EB]/10 ring-2 ring-[#2563EB]/30"
          : "border-border bg-muted/25 hover:border-[#2563EB]/60 hover:bg-muted/40",
        busy && "pointer-events-none opacity-60",
      )}
    >
      <Upload
        className={cn(
          "text-primary",
          isHero ? "h-11 w-11 md:h-12 md:w-12" : "",
        isLibrary ? "h-7 w-7" : "",
        !isHero && !isLibrary ? "h-8 w-8" : "",
          dragActive && "scale-105",
        )}
        aria-hidden
      />
      <span
        className={cn(
          "font-bold tracking-tight text-foreground",
          isHero ? "text-lg md:text-xl" : "",
          isLibrary ? "text-sm" : "",
          !isHero && !isLibrary ? "text-sm" : "",
        )}
      >
        {dragActive ? "Drop video here" : isLibrary ? "Drop or click to upload" : "Drag and drop game film or click to upload"}
      </span>
      <span
        className={cn(
          "max-w-sm leading-relaxed text-muted-foreground",
          isHero ? "text-sm md:text-base" : "",
          isLibrary ? "max-w-none text-[11px] leading-snug" : "",
          !isHero && !isLibrary ? "text-xs" : "",
        )}
      >
        MP4, MOV, WebM, AVI, MKV
      </span>
    </button>
  )

  /** Narrow toolbar strip for film library header — paired with Upload button */
  const compactFilmPickStrip = (
    <button
      type="button"
      disabled={busy}
      onClick={openPicker}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      aria-label={dragActive ? "Drop video here" : "Drop game film or click to browse"}
      className={cn(
        "flex min-h-[40px] min-w-0 flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed px-2 py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        dragActive
          ? "border-[#2563EB] bg-[#2563EB]/10 ring-2 ring-[#2563EB]/30"
          : "border-border bg-muted/25 hover:border-[#2563EB]/60 hover:bg-muted/40",
        busy && "pointer-events-none opacity-60",
      )}
    >
      <Upload className={cn("h-4 w-4 shrink-0 text-primary", dragActive && "scale-105")} aria-hidden />
      <span className="mt-0.5 text-[11px] font-semibold leading-tight text-foreground">
        {dragActive ? "Drop video" : "Drop or browse"}
      </span>
      <span className="text-[10px] leading-none text-muted-foreground">MP4 · MOV · WebM…</span>
    </button>
  )

  const metadataPanel = (
    <div
      className={cn(
        "flex flex-col",
        isHero ? "min-h-[200px] lg:min-h-[240px]" : "",
        metaCompact ? "min-h-0" : "",
        filmRoom ? "bg-muted/25" : "bg-muted/30",
      )}
    >
      <div className={cn("border-b border-border", metaCompact ? "px-4 py-2.5" : "px-5 py-3 md:px-6")}>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Upload details</p>
        <p className={cn("font-semibold text-foreground", metaCompact ? "mt-0.5 text-xs" : "mt-1 text-sm")}>
          {isLibraryInline ? "Title & options" : "Name & organize this film"}
        </p>
      </div>

      <div className={cn("flex flex-1 flex-col", metaCompact ? "gap-3 px-4 py-3" : "gap-4 px-5 py-4 md:px-6")}>
        {!stagedFile ? (
          <p className={cn("leading-relaxed text-muted-foreground", metaCompact ? "text-xs" : "text-sm")}>
            {metaCompact
              ? isLibraryInline
                ? "Choose a file above, then confirm details here."
                : "Choose a file, then set title and privacy before upload."
              : "Drop a file on the left or click to browse. You’ll set the display title, privacy, and optional labels before upload starts."}
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
                className={cn(
                  "mt-2 border-2 font-medium text-foreground",
                  metaCompact ? "min-h-9 text-sm" : "min-h-[48px] text-base",
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
            </div>

            {taggingEnabled && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-foreground">Tags</label>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Comma-separated — for search and filters.</p>
                <Input
                  className={cn("mt-2 border-2 text-foreground", metaCompact ? "min-h-9 text-sm" : "min-h-[44px]")}
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
                  className={cn("mt-2 border-2 text-foreground", metaCompact ? "min-h-9 text-sm" : "min-h-[44px]")}
                  placeholder="Optional"
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-foreground">Category</label>
                <Input
                  className={cn("mt-2 border-2 text-foreground", metaCompact ? "min-h-9 text-sm" : "min-h-[44px]")}
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
                className={cn("mt-2 border-2 text-foreground", metaCompact ? "min-h-9 text-sm" : "min-h-[44px]")}
                value={gameDate}
                onChange={(e) => setGameDate(e.target.value)}
                disabled={busy}
              />
            </div>

            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background/80 px-4 py-3",
                metaCompact && "py-2.5",
              )}
            >
              <Checkbox
                checked={isPrivate}
                disabled={busy}
                onCheckedChange={(c) => setIsPrivate(c === true)}
                className="mt-1"
                aria-label="Private (hide from recruiters)"
              />
              <span className={cn("leading-snug text-foreground", metaCompact ? "text-xs" : "text-sm")}>
                <span className="font-bold">Private (hide from recruiters)</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  Hidden from public recruiting profiles until you change this later in the library.
                </span>
              </span>
            </label>

            <p className="truncate text-xs text-muted-foreground" title={stagedFile.name}>
              <span className="font-semibold text-foreground">File:</span> {stagedFile.name}
            </p>

            <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                size={metaCompact ? "default" : "lg"}
                className={cn(
                  "flex-1 font-bold shadow-md",
                  metaCompact ? "min-h-10" : "min-h-[48px]",
                  filmRoom
                    ? "border-2 border-[#1e40af] bg-[#2563EB] text-white hover:bg-[#1d4ed8]"
                    : "bg-[#2563EB] text-white hover:bg-[#1d4ed8]",
                )}
                disabled={busy}
                onClick={() => void handleStartUpload()}
              >
                Start upload
              </Button>
              <Button type="button" variant="outline" disabled={busy} onClick={clearStaged} className={metaCompact ? "min-h-10" : ""}>
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
              "overflow-hidden rounded-xl ring-1 ring-black/[0.04] dark:ring-white/[0.06]",
              isLibrary || isLibraryInline
                ? "border border-border/90 bg-card shadow-sm"
                : "rounded-2xl border-2 shadow-md border-border bg-card",
              filmRoom && !isLibrary && !isLibraryInline ? "border-white/12 bg-card/80" : "",
            )}
          >
            {isLibraryInline ? (
              stagedFile ? (
                <div className="grid lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:items-stretch">
                  <div
                    className={cn(
                      "border-b border-border lg:border-b-0 lg:border-r lg:border-border",
                      "p-3 sm:p-3.5",
                    )}
                  >
                    {fileSummaryPanel}
                  </div>
                  <div className="min-w-0">{metadataPanel}</div>
                </div>
              ) : (
                <div className="flex flex-col">
                  <div className="flex flex-col gap-2 border-b border-border/80 bg-muted/15 p-3 sm:flex-row sm:items-stretch">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0 gap-2 px-3 font-semibold"
                      disabled={busy}
                      onClick={openPicker}
                    >
                      <Upload className="h-4 w-4" aria-hidden />
                      Upload film
                    </Button>
                    {compactFilmPickStrip}
                  </div>
                  <div className="min-w-0">{metadataPanel}</div>
                </div>
              )
            ) : isHero || isLibrary ? (
              <div
                className={cn(
                  "grid lg:items-stretch",
                  isHero && "lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,1fr)]",
                  isLibrary && "lg:grid-cols-[minmax(200px,260px)_minmax(0,1fr)]",
                )}
              >
                <div
                  className={cn(
                    "lg:border-r lg:border-border",
                    isHero ? "p-5 md:p-6" : "",
                    isLibrary ? "p-3 sm:p-4" : "",
                  )}
                >
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
