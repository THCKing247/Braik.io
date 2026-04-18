"use client"

import type { RefObject } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ClipRow, GameVideoRow } from "@/components/portal/game-video/game-video-types"
import { CoachFilmSidePanel } from "@/components/portal/game-video/coach-film-side-panel"
import { FilmPlayerHero } from "@/components/portal/game-video/film-player-hero"
import { QuickClipBar } from "@/components/portal/game-video/quick-clip-bar"
import { ClipSessionStrip } from "@/components/portal/game-video/clip-session-strip"
import {
  mergeQuickAndFreeTags,
  splitQuickAndFreeFromTags,
} from "@/components/portal/game-video/coach-quick-tags"
import {
  clampMs,
  durationMsLabel,
  formatMsAsTimecode,
  formatMsRange,
} from "@/lib/video/timecode"
import { Button } from "@/components/ui/button"
import { ClipPlayerAttachmentField } from "@/components/portal/game-video/clip-player-attachment-field"

const SKIP_COACH = 5000

type Props = {
  teamId: string
  video: GameVideoRow
  playbackUrl: string | null
  clips: ClipRow[]
  onRefreshClips: () => Promise<void>
  canCreateClips: boolean
  canDeleteVideo: boolean
  aiVideoEnabled: boolean
  taggingEnabled: boolean
  onError: (msg: string | null) => void
  onDeleteVideo: () => Promise<void>
  /** When opening from library with "Open clip", load this clip into the editor once clips are available */
  initialClipId?: string | null
  /** Parent clears URL/state when coach switches to full-film mode */
  onSavedClipContextExit?: () => void
  /** Players linked to the full game video (coach roster attachment). */
  filmAttachedPlayerIds?: string[]
  /** Persist full-film attachments (immediate PATCH). */
  onFilmAttachedPlayerIdsChange?: (ids: string[]) => Promise<void>
}

export function FilmWorkspace({
  teamId,
  video,
  playbackUrl,
  clips,
  onRefreshClips,
  canCreateClips,
  canDeleteVideo,
  aiVideoEnabled,
  taggingEnabled,
  onError,
  onDeleteVideo,
  initialClipId = null,
  onSavedClipContextExit,
  filmAttachedPlayerIds = [],
  onFilmAttachedPlayerIdsChange,
}: Props) {
  const clipTitleInputRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)
  const previewCleanupRef = useRef<(() => void) | null>(null)
  const initialClipAppliedRef = useRef<string | null>(null)
  /** After metadata loads duration, seek playhead to saved clip start once */
  const savedClipSeekKeyRef = useRef<string | null>(null)

  const [durationMs, setDurationMs] = useState(0)
  const [playheadMs, setPlayheadMs] = useState(0)
  const [inMs, setInMs] = useState(0)
  const [outMs, setOutMs] = useState(0)

  const [clipTitle, setClipTitle] = useState("")
  const [clipDescription, setClipDescription] = useState("")
  const [clipTagsFree, setClipTagsFree] = useState("")
  const [quickTagsSelected, setQuickTagsSelected] = useState<Set<string>>(new Set())
  const [clipCategories, setClipCategories] = useState({
    playType: "",
    situation: "",
    personnel: "",
    outcome: "",
  })

  const [fineTuneExpanded, setFineTuneExpanded] = useState(false)
  const [previewActive, setPreviewActive] = useState(false)
  const [highlightClipId, setHighlightClipId] = useState<string | null>(null)
  const [clipSaving, setClipSaving] = useState(false)
  const [aiWorking, setAiWorking] = useState(false)
  const [clipAttachedPlayerIds, setClipAttachedPlayerIds] = useState<string[]>([])

  const [reelClipIds, setReelClipIds] = useState<Set<string>>(new Set())
  /** Newest-first clip ids created in this film-room session (for quick recall without leaving the player). */
  const [sessionClipIds, setSessionClipIds] = useState<string[]>([])

  const durationSafe = durationMs > 0 ? durationMs : 1
  const videoReady = video.upload_status === "ready"
  const clipValid = outMs > inMs + 80

  const reelStorageKey = `braik:coach-reel:${teamId}:${video.id}`

  useEffect(() => {
    try {
      const raw = localStorage.getItem(reelStorageKey)
      if (raw) {
        const arr = JSON.parse(raw) as unknown
        if (Array.isArray(arr)) setReelClipIds(new Set(arr.filter((x): x is string => typeof x === "string")))
      } else {
        setReelClipIds(new Set())
      }
    } catch {
      setReelClipIds(new Set())
    }
  }, [reelStorageKey])

  useEffect(() => {
    try {
      localStorage.setItem(reelStorageKey, JSON.stringify([...reelClipIds]))
    } catch {
      /* ignore quota */
    }
  }, [reelClipIds, reelStorageKey])

  useEffect(() => () => previewCleanupRef.current?.(), [])

  useEffect(() => {
    initialClipAppliedRef.current = null
  }, [initialClipId])

  useEffect(() => {
    initialClipAppliedRef.current = null
    savedClipSeekKeyRef.current = null
    setSessionClipIds([])
    setInMs(0)
    setOutMs(0)
    setPlayheadMs(0)
    setPreviewActive(false)
    setHighlightClipId(null)
    setClipTitle("")
    setClipDescription("")
    setClipTagsFree("")
    setQuickTagsSelected(new Set())
    setClipCategories({ playType: "", situation: "", personnel: "", outcome: "" })
    setFineTuneExpanded(false)
    setClipAttachedPlayerIds([])
  }, [video.id])

  const onVideoMeta = () => {
    const el = videoRef.current
    if (!el || !Number.isFinite(el.duration)) return
    const d = Math.floor(el.duration * 1000)
    setDurationMs(d)
    // Never zero saved clip marks — only clamp to real duration (was wiping library-opened clips).
    setInMs((prev) => clampMs(prev, 0, d))
    setOutMs((prev) => {
      const o = clampMs(prev, 0, d)
      return o <= 0 ? Math.min(15000, d) : o
    })
    setPlayheadMs((prev) => clampMs(prev, 0, d))
  }

  const syncPlayhead = useCallback(() => {
    const el = videoRef.current
    if (!el) return
    const t = Math.floor(el.currentTime * 1000)
    setPlayheadMs(clampMs(t, 0, durationSafe))
  }, [durationSafe])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.addEventListener("timeupdate", syncPlayhead)
    return () => el.removeEventListener("timeupdate", syncPlayhead)
  }, [playbackUrl, syncPlayhead])

  useEffect(() => {
    const el = videoRef.current
    if (!el || !previewActive) return
    const onTu = () => {
      const tMs = Math.floor(el.currentTime * 1000)
      if (tMs >= outMs - 30) {
        if (highlightClipId != null) {
          el.pause()
          el.currentTime = outMs / 1000
          setPreviewActive(false)
        } else {
          el.currentTime = inMs / 1000
        }
      }
    }
    el.addEventListener("timeupdate", onTu)
    return () => el.removeEventListener("timeupdate", onTu)
  }, [previewActive, inMs, outMs, playbackUrl, highlightClipId])

  useEffect(() => {
    if (outMs <= inMs) setOutMs(clampMs(inMs + 500, 0, durationSafe))
  }, [inMs, outMs, durationSafe])

  const seekMs = useCallback(
    (ms: number) => {
      const el = videoRef.current
      if (!el) return
      const x = clampMs(ms, 0, durationSafe)
      el.currentTime = x / 1000
      setPlayheadMs(x)
    },
    [durationSafe],
  )

  const stopPreview = useCallback(() => {
    previewCleanupRef.current?.()
    previewCleanupRef.current = null
    const el = videoRef.current
    setPreviewActive(false)
    el?.pause()
  }, [])

  const startPreview = async () => {
    previewCleanupRef.current?.()
    previewCleanupRef.current = null
    const el = videoRef.current
    if (!el || outMs <= inMs) return
    setPreviewActive(true)
    el.currentTime = inMs / 1000
    try {
      await el.play()
    } catch {
      /* autoplay */
    }
  }

  const pctPlay = useCallback(
    (clientX: number) => {
      const el = timelineRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
      seekMs(Math.floor(ratio * durationSafe))
    },
    [durationSafe, seekMs],
  )

  const applyMarkStart = useCallback(() => setInMs(clampMs(playheadMs, 0, durationSafe)), [playheadMs, durationSafe])
  const applyMarkEnd = useCallback(
    () => setOutMs(clampMs(playheadMs, Math.min(inMs + 100, durationSafe), durationSafe)),
    [playheadMs, inMs, durationSafe],
  )

  const jumpMarkStart = () => seekMs(inMs)
  const jumpMarkEnd = () => seekMs(outMs)

  const nudgePlayhead = (deltaMs: number) => seekMs(playheadMs + deltaMs)
  const nudgeIn = (d: number) => setInMs(clampMs(inMs + d, 0, Math.max(0, outMs - 100)))
  const nudgeOut = (d: number) =>
    setOutMs(clampMs(outMs + d, Math.min(inMs + 100, durationSafe), durationSafe))

  const clipDurationLabel = useMemo(() => durationMsLabel(inMs, outMs), [inMs, outMs])

  const timingSummaryForAi = useMemo(() => {
    return [
      `Marked range ${formatMsRange(inMs, outMs)}`,
      `Clip length ${clipDurationLabel}`,
      durationMs ? `Full film ${formatMsAsTimecode(durationMs)}` : "",
    ]
      .filter(Boolean)
      .join(" · ")
  }, [inMs, outMs, clipDurationLabel, durationMs])

  const resetMarks = () => {
    setInMs(0)
    setOutMs(Math.min(15000, durationSafe))
    seekMs(0)
    stopPreview()
  }

  const toggleQuickTag = (tag: string) => {
    setQuickTagsSelected((prev) => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  const toggleReel = (clipId: string) => {
    setReelClipIds((prev) => {
      const next = new Set(prev)
      if (next.has(clipId)) next.delete(clipId)
      else next.add(clipId)
      return next
    })
  }

  const runAiAssist = async () => {
    if (!aiVideoEnabled) return
    const notes = clipDescription.trim() || clipTitle.trim()
    if (!notes) {
      onError("Add a coaching note first — the assistant reads what you typed, not the video pixels.")
      return
    }
    setAiWorking(true)
    onError(null)
    try {
      const tagLine = taggingEnabled ? commaFromQuickAndFree() : ""
      const res = await fetch(`/api/teams/${teamId}/video-clips/ai-suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: [notes, tagLine ? `Tags / labels: ${tagLine}` : ""].filter(Boolean).join("\n"),
          transcript: "",
          existingTitle: clipTitle || null,
          clipTimingSummary: timingSummaryForAi,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Assistant request failed")
      if (data.suggestedTitle) setClipTitle(data.suggestedTitle)
      if (data.suggestedDescription) setClipDescription(data.suggestedDescription)
      if (Array.isArray(data.suggestedTags) && data.suggestedTags.length && taggingEnabled) {
        const incoming = data.suggestedTags.map((t: unknown) => String(t).trim()).filter(Boolean)
        const { quickSelected, freeComma } = splitQuickAndFreeFromTags(incoming)
        setQuickTagsSelected(quickSelected)
        setClipTagsFree(freeComma)
      }
      const cats = data.suggestedCategories as Record<string, string> | undefined
      if (cats && typeof cats === "object") {
        setClipCategories((prev) => ({
          playType: cats.playType ?? prev.playType,
          situation: cats.situation ?? prev.situation,
          personnel: cats.personnel ?? prev.personnel,
          outcome: cats.outcome ?? prev.outcome,
        }))
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Assistant failed")
    } finally {
      setAiWorking(false)
    }
  }

  function commaFromQuickAndFree(): string {
    return mergeQuickAndFreeTags(quickTagsSelected, clipTagsFree).join(", ")
  }

  const clearNewClipForm = () => {
    setClipTitle("")
    setClipDescription("")
    setClipTagsFree("")
    setQuickTagsSelected(new Set())
    setClipCategories({ playType: "", situation: "", personnel: "", outcome: "" })
    setClipAttachedPlayerIds([])
  }

  const prepareNextClipRange = (savedOutMs: number) => {
    setHighlightClipId(null)
    onSavedClipContextExit?.()
    const nextIn = clampMs(savedOutMs, 0, durationSafe - 100)
    let nextOut = clampMs(savedOutMs + 12000, nextIn + 100, durationSafe)
    if (nextOut <= nextIn + 80) {
      nextOut = clampMs(nextIn + 8000, nextIn + 100, durationSafe)
    }
    setInMs(nextIn)
    setOutMs(nextOut)
    seekMs(nextIn)
    stopPreview()
    clearNewClipForm()
    requestAnimationFrame(() => clipTitleInputRef.current?.focus())
  }

  const saveClipRequest = async (advanceForNext: boolean) => {
    if (!canCreateClips || !videoReady) return
    if (!clipValid) {
      onError("Mark where the play ends — it has to be after the start.")
      return
    }
    const tags = taggingEnabled ? mergeQuickAndFreeTags(quickTagsSelected, clipTagsFree) : []
    const categories: Record<string, string> = {}
    if (clipCategories.playType.trim()) categories.playType = clipCategories.playType.trim()
    if (clipCategories.situation.trim()) categories.situation = clipCategories.situation.trim()
    if (clipCategories.personnel.trim()) categories.personnel = clipCategories.personnel.trim()
    if (clipCategories.outcome.trim()) categories.outcome = clipCategories.outcome.trim()

    const title = clipTitle.trim() || "Clip"
    const description = clipDescription.trim() || null
    const payload = {
      startMs: inMs,
      endMs: outMs,
      title,
      description,
      tags,
      categories,
      playerIds: clipAttachedPlayerIds,
    }

    const savedOutMs = outMs
    const editingId = highlightClipId

    setClipSaving(true)
    onError(null)
    try {
      const res = editingId
        ? await fetch(`/api/teams/${teamId}/game-videos/${video.id}/clips/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/teams/${teamId}/game-videos/${video.id}/clips`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not save clip")

      await onRefreshClips()

      const nextAttach = Array.isArray((data as { clip?: { attachedPlayerIds?: string[] } }).clip?.attachedPlayerIds)
        ? ((data as { clip: { attachedPlayerIds: string[] } }).clip.attachedPlayerIds)
        : clipAttachedPlayerIds
      setClipAttachedPlayerIds(nextAttach)

      if (!editingId && typeof data.clip?.id === "string") {
        const id = data.clip.id as string
        setSessionClipIds((prev) => [id, ...prev.filter((x) => x !== id)])
      }

      if (advanceForNext) {
        prepareNextClipRange(savedOutMs)
      } else {
        stopPreview()
        if (editingId) {
          /* keep form + marks for further tweaks */
        } else {
          clearNewClipForm()
        }
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : "Clip save failed")
    } finally {
      setClipSaving(false)
    }
  }

  const saveClipRequestRef = useRef(saveClipRequest)
  saveClipRequestRef.current = saveClipRequest

  const deleteClip = async (clipId: string) => {
    if (!confirm("Remove this clip?")) return
    try {
      const res = await fetch(`/api/teams/${teamId}/game-videos/${video.id}/clips/${clipId}`, {
        method: "DELETE",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Delete failed")
      if (highlightClipId === clipId) setHighlightClipId(null)
      setSessionClipIds((prev) => prev.filter((id) => id !== clipId))
      setReelClipIds((prev) => {
        const next = new Set(prev)
        next.delete(clipId)
        return next
      })
      await onRefreshClips()
    } catch (e) {
      onError(e instanceof Error ? e.message : "Delete failed")
    }
  }

  const loadClipIntoEditor = useCallback(
    (c: ClipRow) => {
      setHighlightClipId(c.id)
      setInMs(c.start_ms)
      setOutMs(c.end_ms)
      setClipTitle(c.title || "")
      setClipDescription(c.description || "")
      const tags = Array.isArray(c.tags) ? c.tags : []
      const { quickSelected, freeComma } = splitQuickAndFreeFromTags(tags)
      setQuickTagsSelected(quickSelected)
      setClipTagsFree(freeComma)
      const mc = c.metadata?.categories
      setClipCategories({
        playType: mc?.playType ?? "",
        situation: mc?.situation ?? "",
        personnel: mc?.personnel ?? "",
        outcome: mc?.outcome ?? "",
      })
      setClipAttachedPlayerIds(Array.isArray(c.attachedPlayerIds) ? c.attachedPlayerIds : [])
      seekMs(c.start_ms)
      stopPreview()
    },
    [seekMs, stopPreview],
  )

  useEffect(() => {
    if (!initialClipId) return
    const key = `${video.id}:${initialClipId}`
    if (initialClipAppliedRef.current === key) return
    const c = clips.find((x) => x.id === initialClipId)
    if (!c) return
    initialClipAppliedRef.current = key
    loadClipIntoEditor(c)
  }, [clips, initialClipId, video.id, loadClipIntoEditor])

  /** Real duration required for correct seek — library often opened clip before metadata */
  useEffect(() => {
    if (!highlightClipId || durationMs <= 0) return
    const c = clips.find((x) => x.id === highlightClipId)
    if (!c) return
    const key = `${video.id}:${highlightClipId}`
    if (savedClipSeekKeyRef.current === key) return
    savedClipSeekKeyRef.current = key
    seekMs(c.start_ms)
  }, [highlightClipId, durationMs, clips, video.id, seekMs])

  const enterFullFilmMode = useCallback(() => {
    savedClipSeekKeyRef.current = null
    initialClipAppliedRef.current = null
    setHighlightClipId(null)
    stopPreview()
    const d = durationSafe > 1 ? durationSafe : 1
    setInMs(0)
    setOutMs(Math.min(15000, d))
    seekMs(0)
    setClipTitle("")
    setClipDescription("")
    setClipTagsFree("")
    setQuickTagsSelected(new Set())
    setClipCategories({ playType: "", situation: "", personnel: "", outcome: "" })
    setClipAttachedPlayerIds([])
    onSavedClipContextExit?.()
  }, [durationSafe, seekMs, stopPreview, onSavedClipContextExit])

  const previewSavedClip = async (c: ClipRow) => {
    previewCleanupRef.current?.()
    setHighlightClipId(c.id)
    const el = videoRef.current
    if (!el) return
    el.currentTime = c.start_ms / 1000
    setPreviewActive(true)
    try {
      await el.play()
    } catch {
      /* ignore */
    }
    const stopAt = c.end_ms / 1000
    const check = () => {
      if (el.currentTime >= stopAt - 0.04) {
        el.pause()
        setPreviewActive(false)
        previewCleanupRef.current?.()
        previewCleanupRef.current = null
      }
    }
    el.addEventListener("timeupdate", check)
    previewCleanupRef.current = () => {
      el.removeEventListener("timeupdate", check)
    }
  }

  const skipBack5 = () => nudgePlayhead(-SKIP_COACH)
  const skipForward5 = () => nudgePlayhead(SKIP_COACH)
  const replayMarkedClip = () => void startPreview()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)
      ) {
        return
      }
      if (e.code === "KeyI" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        applyMarkStart()
      } else if (e.code === "KeyO" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        applyMarkEnd()
      } else if (e.code === "Enter" && (e.ctrlKey || e.metaKey) && clipValid && canCreateClips && videoReady) {
        e.preventDefault()
        void saveClipRequestRef.current(true)
      } else if (e.code === "KeyS" && e.shiftKey && (e.ctrlKey || e.metaKey) && clipValid && canCreateClips && videoReady) {
        e.preventDefault()
        void saveClipRequestRef.current(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [clipValid, canCreateClips, videoReady, applyMarkStart, applyMarkEnd])

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
      <div className="min-w-0 flex-1 space-y-4">
        {highlightClipId && (
          <div
            className="rounded-2xl border-2 border-primary bg-primary/10 px-4 py-4 shadow-md sm:px-6"
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-primary">Saved clip — editing</p>
                <h3 className="mt-1 text-xl font-bold leading-tight text-foreground">
                  {clipTitle || "Untitled clip"}
                </h3>
                <p className="mt-2 font-mono text-sm font-semibold text-foreground">
                  {formatMsRange(inMs, outMs)} · Length {clipDurationLabel}
                </p>
                {clipDescription.trim() && (
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {clipDescription}
                  </p>
                )}
                {mergeQuickAndFreeTags(quickTagsSelected, clipTagsFree).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {mergeQuickAndFreeTags(quickTagsSelected, clipTagsFree)
                      .slice(0, 12)
                      .map((t) => (
                        <span
                          key={t}
                          className="rounded-lg bg-background/80 px-2.5 py-1 text-xs font-semibold text-foreground ring-1 ring-border"
                        >
                          {t}
                        </span>
                      ))}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="h-12 shrink-0 border-2 border-border font-bold"
                onClick={enterFullFilmMode}
              >
                Full film mode
              </Button>
            </div>
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
              Scrubber shows this clip’s range. Use <strong className="text-foreground">Preview clip</strong> to play only this
              segment (stops at the end). Switch to full film to mark a new clip or browse the whole game.
            </p>
          </div>
        )}

        <header className="rounded-xl border-2 border-border bg-muted/40 px-4 py-4 sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Source film</p>
          <h2 className="mt-1 truncate text-2xl font-bold tracking-tight text-foreground">{video.title || "Untitled film"}</h2>
          <p className="mt-2 text-sm leading-snug text-slate-700 dark:text-slate-300">
            {highlightClipId
              ? "Film plays behind your saved clip — timeline range matches the clip below."
              : "Drag the scrubber or use the controls. Mark start/end, then use Save & next clip to knock out plays in one sitting."}
          </p>
        </header>

        {canCreateClips && videoReady && onFilmAttachedPlayerIdsChange && (
          <div className="hidden lg:block rounded-xl border-2 border-border bg-muted/30 px-4 py-4 sm:px-6">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Full film — roster links
            </p>
            <ClipPlayerAttachmentField
              teamId={teamId}
              selectedIds={filmAttachedPlayerIds}
              disabled={clipSaving}
              onChange={(ids) => {
                void onFilmAttachedPlayerIdsChange(ids).catch((e) =>
                  onError(e instanceof Error ? e.message : "Could not update film roster links"),
                )
              }}
            />
            <p className="mt-2 text-[11px] text-muted-foreground">
              Optional. Links this whole file to selected athletes’ recruiting profiles. Use clip attachments below for play-level
              highlights.
            </p>
          </div>
        )}

        {sessionClipIds.length > 0 && (
          <ClipSessionStrip
            clips={clips}
            sessionOrder={sessionClipIds}
            highlightClipId={highlightClipId}
            onSelectClip={(c) => loadClipIntoEditor(c)}
          />
        )}

        <FilmPlayerHero
          playbackUrl={playbackUrl}
          videoRef={videoRef as RefObject<HTMLVideoElement>}
          playbackKey={playbackUrl ?? ""}
          previewActive={previewActive}
          durationSafe={durationSafe}
          playheadMs={playheadMs}
          inMs={inMs}
          outMs={outMs}
          clipDurationLabel={clipDurationLabel}
          timelineRef={timelineRef as RefObject<HTMLDivElement>}
          onLoadedMetadata={onVideoMeta}
          syncPlayhead={syncPlayhead}
          onTimelinePointerDown={pctPlay}
          fineTuneExpanded={fineTuneExpanded}
          onNudgePlayhead={nudgePlayhead}
          onNudgeIn={nudgeIn}
          onNudgeOut={nudgeOut}
          onSetInMs={(ms) => setInMs(ms)}
          onSetOutMs={(ms) => setOutMs(ms)}
        />

        {!videoReady && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
            This film is still processing. Refresh in a moment — marking and clips unlock when status shows Ready in your
            library.
          </div>
        )}

        <QuickClipBar
          enabled={canCreateClips && videoReady}
          savedClipEditing={!!highlightClipId}
          previewActive={previewActive}
          clipValid={clipValid}
          saving={clipSaving}
          fineTuneExpanded={fineTuneExpanded}
          onToggleFineTune={() => setFineTuneExpanded((v) => !v)}
          onMarkStart={applyMarkStart}
          onMarkEnd={applyMarkEnd}
          onPreview={() => void startPreview()}
          onStopPreview={stopPreview}
          onSaveClip={() => void saveClipRequest(false)}
          onSaveAndContinue={() => void saveClipRequest(true)}
          onResetMarks={resetMarks}
          onSkipBack5={skipBack5}
          onSkipForward5={skipForward5}
          onReplayClip={replayMarkedClip}
          onJumpToMarkStart={jumpMarkStart}
          onJumpToMarkEnd={jumpMarkEnd}
        />

        <p className="rounded-lg bg-muted/60 px-3 py-2 text-center text-sm font-medium text-foreground xl:hidden">
          Clip name, tags, coaching notes, assistant, and saved clips — scroll down on smaller screens.
        </p>
      </div>

      <div className="flex w-full shrink-0 flex-col xl:sticky xl:top-0 xl:max-h-[calc(100dvh-12rem)] xl:w-[420px] xl:max-w-[min(440px,44vw)] xl:overflow-hidden">
        <CoachFilmSidePanel
          clipTitleInputRef={clipTitleInputRef}
          clipCount={clips.length}
          reelCount={reelClipIds.size}
          canCreateClips={canCreateClips}
          videoReady={videoReady}
          taggingEnabled={taggingEnabled}
          aiVideoEnabled={aiVideoEnabled}
          aiWorking={aiWorking}
          clipTitle={clipTitle}
          setClipTitle={setClipTitle}
          clipCategories={clipCategories}
          setClipCategories={setClipCategories}
          clipDescription={clipDescription}
          setClipDescription={setClipDescription}
          quickTagsSelected={quickTagsSelected}
          toggleQuickTag={toggleQuickTag}
          clipTagsFree={clipTagsFree}
          setClipTagsFree={setClipTagsFree}
          canDeleteVideo={canDeleteVideo}
          onDeleteVideo={onDeleteVideo}
          onRunAiAssist={runAiAssist}
          clips={clips}
          highlightClipId={highlightClipId}
          reelClipIds={reelClipIds}
          onToggleReel={toggleReel}
          onLoadClipInEditor={loadClipIntoEditor}
          onPreviewClip={(c) => {
            loadClipIntoEditor(c)
            void previewSavedClip(c)
          }}
          onDeleteClip={(id) => void deleteClip(id)}
          teamId={teamId}
          clipAttachedPlayerIds={clipAttachedPlayerIds}
          onClipAttachedPlayerIdsChange={setClipAttachedPlayerIds}
        />
      </div>
    </div>
  )
}
