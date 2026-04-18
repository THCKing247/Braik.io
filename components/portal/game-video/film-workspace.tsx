"use client"

import type { RefObject } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ClipRow, GameVideoRow } from "@/components/portal/game-video/game-video-types"
import { CoachFilmSidePanel } from "@/components/portal/game-video/coach-film-side-panel"
import { CaptureStepPanel } from "@/components/portal/game-video/capture-step-panel"
import { FinalizeStepPanel } from "@/components/portal/game-video/finalize-step-panel"
import { FilmFullRosterLinksCard } from "@/components/portal/game-video/film-full-roster-links-card"
import { FilmWorkflowStepper, type FilmWorkflowStep } from "@/components/portal/game-video/film-workflow-stepper"
import { NameTagStepPanel } from "@/components/portal/game-video/name-tag-step-panel"
import { ReviewStepPanel } from "@/components/portal/game-video/review-step-panel"
import { FilmPlayerHero } from "@/components/portal/game-video/film-player-hero"
import { QuickClipBar } from "@/components/portal/game-video/quick-clip-bar"
import { ClipSessionStrip } from "@/components/portal/game-video/clip-session-strip"
import type { FilmDraftClip, MarkPhase } from "@/components/portal/game-video/film-draft-types"
import { nextDraftSlotLabel } from "@/components/portal/game-video/film-draft-types"
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
import { TooltipProvider } from "@/components/ui/tooltip"
import { FilmPreviewThumbnailLane } from "@/components/portal/game-video/film-preview-thumbnail-lane"
import { captureClientPreviewStrip } from "@/lib/video/client-preview-strip"
import {
  DEFAULT_FILM_EDITOR_FPS,
  frameDurationMs,
  frameOrdinalAtPlayhead,
  normalizeFpsChoice,
  snapMsToFrameGrid,
  stepPlayheadMsByFrames,
} from "@/lib/video/frame-timing"
import { cn } from "@/lib/utils"
import { FilmRoomShell } from "@/components/portal/game-video/film-room-shell"
import {
  FilmAnnotationOverlay,
  FilmAnnotationToolbar,
  type FilmAnnotationStroke,
  type FilmAnnotationTool,
} from "@/components/portal/game-video/film-annotation-overlay"
import {
  FilmRoomExperienceToggle,
  FilmRoomReviewSidebar,
} from "@/components/portal/game-video/film-room-review-sidebar"

const SKIP_COACH = 5000

type FilmRoomExperienceMode = "review" | "edit"

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
  /** Synchronous guard so preview loop timeupdate handlers never fight main transport (React effect cleanup is one frame late). */
  const transportModeRef = useRef<"idle" | "preview" | "main_clip" | "main_full">("idle")
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
  const [mainPlayActive, setMainPlayActive] = useState(false)
  const [mainPlayFullFilm, setMainPlayFullFilm] = useState(false)
  const [videoPaused, setVideoPaused] = useState(true)

  const [reelClipIds, setReelClipIds] = useState<Set<string>>(new Set())
  /** Newest-first clip ids created in this film-room session (for quick recall without leaving the player). */
  const [sessionClipIds, setSessionClipIds] = useState<string[]>([])

  const [workflowStep, setWorkflowStep] = useState<FilmWorkflowStep>(1)
  const [experienceMode, setExperienceMode] = useState<FilmRoomExperienceMode>("review")
  const [annotationTool, setAnnotationTool] = useState<FilmAnnotationTool>("none")
  const [annotationStrokes, setAnnotationStrokes] = useState<FilmAnnotationStroke[]>([])

  const [draftClips, setDraftClips] = useState<FilmDraftClip[]>([])
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null)
  const [bulkDraftIds, setBulkDraftIds] = useState<Set<string>>(new Set())
  /** Brief highlight in the draft list after logging a clip without selecting it (continuous marking). */
  const [recentlyLoggedDraftId, setRecentlyLoggedDraftId] = useState<string | null>(null)
  const [markPhase, setMarkPhase] = useState<MarkPhase>("idle")
  const [pendingStartMs, setPendingStartMs] = useState<number | null>(null)

  const fpsStorageKey = `braik:film-editor-fps:${video.id}`
  const [editorFps, setEditorFps] = useState(DEFAULT_FILM_EDITOR_FPS)
  const [previewStripTiles, setPreviewStripTiles] = useState<Array<{ tMs: number; src: string }>>([])
  const [previewStripStatus, setPreviewStripStatus] = useState<
    "idle" | "loading" | "ready" | "error" | "none"
  >("idle")

  const durationSafe = durationMs > 0 ? durationMs : 1
  const videoReady = video.upload_status === "ready"

  const displayInMs = useMemo(() => {
    if (highlightClipId) return inMs
    if (markPhase === "await_end" && pendingStartMs != null) return pendingStartMs
    if (selectedDraftId) {
      const d = draftClips.find((x) => x.id === selectedDraftId)
      if (d) return d.startMs
    }
    return inMs
  }, [highlightClipId, inMs, markPhase, pendingStartMs, selectedDraftId, draftClips])

  const displayOutMs = useMemo(() => {
    if (highlightClipId) return outMs
    if (markPhase === "await_end" && pendingStartMs != null)
      return clampMs(playheadMs, pendingStartMs + 100, durationSafe)
    if (selectedDraftId) {
      const d = draftClips.find((x) => x.id === selectedDraftId)
      if (d) return d.endMs
    }
    return outMs
  }, [highlightClipId, outMs, markPhase, pendingStartMs, playheadMs, durationSafe, selectedDraftId, draftClips])

  const clipValid = displayOutMs > displayInMs + 80

  /** Preview loop targets the active mark range or selected draft — not idle “whole film” scrubber defaults. */
  const previewClipAllowed = useMemo(() => {
    if (!clipValid) return false
    if (highlightClipId) return true
    return markPhase === "await_end" || selectedDraftId != null
  }, [clipValid, highlightClipId, markPhase, selectedDraftId])

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
    setMainPlayActive(false)
    setMainPlayFullFilm(false)
    transportModeRef.current = "idle"
    setDraftClips([])
    setSelectedDraftId(null)
    setBulkDraftIds(new Set())
    setMarkPhase("idle")
    setPendingStartMs(null)
    setPreviewStripTiles([])
    setPreviewStripStatus("idle")
    setRecentlyLoggedDraftId(null)
    setWorkflowStep(1)
    setExperienceMode("review")
    setAnnotationStrokes([])
    setAnnotationTool("none")
  }, [video.id])

  useEffect(() => {
    if (!recentlyLoggedDraftId) return
    const t = window.setTimeout(() => setRecentlyLoggedDraftId(null), 2200)
    return () => window.clearTimeout(t)
  }, [recentlyLoggedDraftId])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(fpsStorageKey)
      if (raw) {
        const n = Number(raw)
        if (Number.isFinite(n)) setEditorFps(normalizeFpsChoice(n))
      } else {
        setEditorFps(DEFAULT_FILM_EDITOR_FPS)
      }
    } catch {
      setEditorFps(DEFAULT_FILM_EDITOR_FPS)
    }
  }, [fpsStorageKey])

  useEffect(() => {
    try {
      localStorage.setItem(fpsStorageKey, String(editorFps))
    } catch {
      /* ignore */
    }
  }, [fpsStorageKey, editorFps])

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
    if (!el) return
    const syncPaused = () => setVideoPaused(el.paused)
    el.addEventListener("play", syncPaused)
    el.addEventListener("pause", syncPaused)
    syncPaused()
    return () => {
      el.removeEventListener("play", syncPaused)
      el.removeEventListener("pause", syncPaused)
    }
  }, [playbackUrl])

  useEffect(() => {
    const el = videoRef.current
    if (!el || !previewActive) return
    const onTu = () => {
      if (transportModeRef.current !== "preview") return
      const tMs = Math.floor(el.currentTime * 1000)
      if (tMs >= displayOutMs - 30) {
        if (highlightClipId != null) {
          el.pause()
          el.currentTime = displayOutMs / 1000
          setPreviewActive(false)
        } else {
          el.currentTime = displayInMs / 1000
        }
      }
    }
    el.addEventListener("timeupdate", onTu)
    return () => el.removeEventListener("timeupdate", onTu)
  }, [previewActive, displayInMs, displayOutMs, playbackUrl, highlightClipId])

  const stopMainPlay = useCallback(() => {
    transportModeRef.current = "idle"
    setMainPlayActive(false)
    setMainPlayFullFilm(false)
    videoRef.current?.pause()
  }, [])

  /** Stops at end of film (full) or at out point (clip segment); separate from Preview clip loop */
  useEffect(() => {
    const el = videoRef.current
    if (!el || !mainPlayActive || durationMs < 1) return

    const onTu = () => {
      const tMs = Math.floor(el.currentTime * 1000)
      if (mainPlayFullFilm) {
        if (tMs >= durationSafe - 80) {
          el.pause()
          el.currentTime = Math.max(0, (durationSafe - 1) / 1000)
          stopMainPlay()
        }
        return
      }
      if (tMs >= displayOutMs - 30) {
        el.pause()
        el.currentTime = displayOutMs / 1000
        stopMainPlay()
      }
    }
    el.addEventListener("timeupdate", onTu)
    return () => el.removeEventListener("timeupdate", onTu)
  }, [mainPlayActive, mainPlayFullFilm, displayOutMs, durationMs, durationSafe, playbackUrl, stopMainPlay])

  useEffect(() => {
    if (!highlightClipId) return
    if (outMs <= inMs) setOutMs(clampMs(inMs + 500, 0, durationSafe))
  }, [highlightClipId, inMs, outMs, durationSafe])

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

  const releasePreviewOverlay = useCallback(() => {
    previewCleanupRef.current?.()
    previewCleanupRef.current = null
    transportModeRef.current = "idle"
    setPreviewActive(false)
  }, [])

  const stopPreview = useCallback(() => {
    previewCleanupRef.current?.()
    previewCleanupRef.current = null
    transportModeRef.current = "idle"
    const el = videoRef.current
    setPreviewActive(false)
    el?.pause()
  }, [])

  const startPreview = useCallback(async () => {
    if (
      !highlightClipId &&
      markPhase === "idle" &&
      selectedDraftId == null
    ) {
      return
    }
    stopMainPlay()
    previewCleanupRef.current?.()
    previewCleanupRef.current = null
    const el = videoRef.current
    if (!el || displayOutMs <= displayInMs) return
    transportModeRef.current = "preview"
    setPreviewActive(true)
    el.currentTime = displayInMs / 1000
    try {
      await el.play()
    } catch {
      transportModeRef.current = "idle"
      setPreviewActive(false)
    }
  }, [
    highlightClipId,
    markPhase,
    selectedDraftId,
    stopMainPlay,
    displayOutMs,
    displayInMs,
  ])

  const clipSegmentPlayMode =
    Boolean(highlightClipId) || markPhase === "await_end" || selectedDraftId != null

  const willPlayMarkedClipOnce = clipSegmentPlayMode && clipValid

  const toggleMainPlay = useCallback(async () => {
    if (!videoReady || !playbackUrl) {
      if (videoReady && !playbackUrl) onError("Playback is still loading — try again in a moment.")
      return
    }
    const el = videoRef.current
    if (!el) return

    if (mainPlayActive) {
      if (!el.paused) {
        el.pause()
        return
      }
      try {
        await el.play()
      } catch (err) {
        const msg =
          err instanceof DOMException && err.name === "NotAllowedError"
            ? "Playback was blocked. Click play again or interact with the page first."
            : "Could not resume playback."
        onError(msg)
      }
      return
    }

    stopPreview()
    previewCleanupRef.current?.()
    previewCleanupRef.current = null

    const playMarkedClipOnce = clipSegmentPlayMode && clipValid

    if (playMarkedClipOnce) {
      transportModeRef.current = "main_clip"
      setMainPlayFullFilm(false)
      setMainPlayActive(true)
      el.currentTime = displayInMs / 1000
    } else {
      transportModeRef.current = "main_full"
      setMainPlayFullFilm(true)
      setMainPlayActive(true)
    }

    try {
      await el.play()
    } catch (err) {
      transportModeRef.current = "idle"
      setMainPlayActive(false)
      setMainPlayFullFilm(false)
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Playback was blocked. Click play again or interact with the page first."
          : "Could not start playback."
      onError(msg)
    }
  }, [
    videoReady,
    mainPlayActive,
    clipSegmentPlayMode,
    clipValid,
    displayInMs,
    stopPreview,
    playbackUrl,
    onError,
  ])

  const mainPlayPrimaryLabel =
    mainPlayActive && !videoPaused
      ? "Pause"
      : mainPlayActive && videoPaused
        ? "Resume"
        : willPlayMarkedClipOnce
          ? "Play clip"
          : "Play film"

  const mainPlayDisabled = !videoReady || !playbackUrl

  const mainPlayDisabledReason = !videoReady
    ? "Film is still processing."
    : !playbackUrl
      ? "Loading playback…"
      : undefined

  const playbackScopeHint = useMemo(() => {
    if (previewActive) return "Preview loops the in→out range until you stop."
    if (!playbackUrl) return "Loading playback URL…"
    if (mainPlayActive) {
      return mainPlayFullFilm
        ? "Playing full film from the scrubber position."
        : "Playing the marked in→out range once."
    }
    if (willPlayMarkedClipOnce) return "Plays from in to out once (starts at the in mark)."
    return "Plays full film from the current playhead."
  }, [previewActive, playbackUrl, mainPlayActive, mainPlayFullFilm, willPlayMarkedClipOnce])

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

  const discardOpenMark = useCallback(() => {
    setMarkPhase("idle")
    setPendingStartMs(null)
    releasePreviewOverlay()
  }, [releasePreviewOverlay])

  const applyMarkStart = useCallback(() => {
    if (highlightClipId) {
      setInMs(snapMsToFrameGrid(clampMs(playheadMs, 0, durationSafe), editorFps))
      return
    }
    const t = snapMsToFrameGrid(clampMs(playheadMs, 0, durationSafe), editorFps)
    if (markPhase === "await_end") {
      setPendingStartMs(t)
      return
    }
    setHighlightClipId(null)
    onSavedClipContextExit?.()
    setSelectedDraftId(null)
    setPendingStartMs(t)
    setMarkPhase("await_end")
  }, [highlightClipId, playheadMs, durationSafe, markPhase, onSavedClipContextExit, editorFps])

  const applyMarkEnd = useCallback(() => {
    if (highlightClipId) {
      setOutMs(
        snapMsToFrameGrid(
          clampMs(playheadMs, Math.min(inMs + 100, durationSafe), durationSafe),
          editorFps,
        ),
      )
      return
    }
    if (markPhase !== "await_end" || pendingStartMs == null) {
      onError("Press Mark start first — then Mark end when the play finishes.")
      return
    }
    const rawEnd = clampMs(playheadMs, pendingStartMs + 100, durationSafe)
    const startSnapped = snapMsToFrameGrid(pendingStartMs, editorFps)
    const endMs = snapMsToFrameGrid(rawEnd, editorFps)
    if (endMs <= startSnapped + 80) {
      onError("End mark must be clearly after start — scrub forward and try again.")
      return
    }
    const slotIdx = draftClips.length
    const slotLabel = nextDraftSlotLabel(slotIdx)
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const draft: FilmDraftClip = {
      id,
      startMs: startSnapped,
      endMs,
      slotLabel,
      titleDraft: slotLabel,
      description: "",
      quickTagKeys: [],
      clipTagsFree: "",
      categories: { playType: "", situation: "", personnel: "", outcome: "" },
      attachedPlayerIds: [],
    }
    setDraftClips((prev) => [...prev, draft])
    setBulkDraftIds((prev) => new Set(prev).add(id))
    setRecentlyLoggedDraftId(id)
    setSelectedDraftId(null)
    setClipTitle("")
    setClipDescription("")
    setClipTagsFree("")
    setQuickTagsSelected(new Set())
    setClipCategories({ playType: "", situation: "", personnel: "", outcome: "" })
    setClipAttachedPlayerIds([])
    setPendingStartMs(null)
    setMarkPhase("idle")
    releasePreviewOverlay()
  }, [
    highlightClipId,
    playheadMs,
    inMs,
    durationSafe,
    markPhase,
    pendingStartMs,
    draftClips.length,
    onError,
    releasePreviewOverlay,
    editorFps,
  ])

  const jumpMarkStart = () => seekMs(displayInMs)
  const jumpMarkEnd = () => seekMs(displayOutMs)

  const stepPlayheadFrames = useCallback(
    (deltaFrames: number) => {
      stopPreview()
      stopMainPlay()
      const next = stepPlayheadMsByFrames(playheadMs, deltaFrames, editorFps, durationSafe)
      seekMs(next)
    },
    [stopPreview, stopMainPlay, playheadMs, editorFps, durationSafe, seekMs],
  )

  const nudgePlayhead = (deltaMs: number) => seekMs(playheadMs + deltaMs)
  const nudgeIn = (d: number) => {
    if (highlightClipId) {
      setInMs(clampMs(inMs + d, 0, Math.max(0, outMs - 100)))
      return
    }
    if (selectedDraftId) {
      setDraftClips((prev) =>
        prev.map((x) =>
          x.id === selectedDraftId
            ? { ...x, startMs: clampMs(x.startMs + d, 0, Math.max(0, x.endMs - 100)) }
            : x,
        ),
      )
      return
    }
    setInMs(clampMs(inMs + d, 0, Math.max(0, outMs - 100)))
  }
  const nudgeOut = (d: number) => {
    if (highlightClipId) {
      setOutMs(clampMs(outMs + d, Math.min(inMs + 100, durationSafe), durationSafe))
      return
    }
    if (selectedDraftId) {
      setDraftClips((prev) =>
        prev.map((x) =>
          x.id === selectedDraftId
            ? { ...x, endMs: clampMs(x.endMs + d, Math.min(x.startMs + 100, durationSafe), durationSafe) }
            : x,
        ),
      )
      return
    }
    setOutMs(clampMs(outMs + d, Math.min(inMs + 100, durationSafe), durationSafe))
  }

  const nudgeMarkInFrames = (deltaFrames: number) => {
    nudgeIn(frameDurationMs(editorFps) * deltaFrames)
  }
  const nudgeMarkOutFrames = (deltaFrames: number) => {
    nudgeOut(frameDurationMs(editorFps) * deltaFrames)
  }

  const setInMsFromTimeline = useCallback(
    (ms: number) => {
      if (highlightClipId) {
        setInMs(ms)
        return
      }
      if (selectedDraftId) {
        setDraftClips((prev) =>
          prev.map((x) =>
            x.id === selectedDraftId ? { ...x, startMs: clampMs(ms, 0, Math.max(0, x.endMs - 100)) } : x,
          ),
        )
        return
      }
      setInMs(ms)
    },
    [highlightClipId, selectedDraftId],
  )
  const setOutMsFromTimeline = useCallback(
    (ms: number) => {
      if (highlightClipId) {
        setOutMs(ms)
        return
      }
      if (selectedDraftId) {
        setDraftClips((prev) =>
          prev.map((x) =>
            x.id === selectedDraftId
              ? { ...x, endMs: clampMs(ms, Math.min(x.startMs + 100, durationSafe), durationSafe) }
              : x,
          ),
        )
        return
      }
      setOutMs(ms)
    },
    [highlightClipId, selectedDraftId, durationSafe],
  )

  const clipDurationLabel = useMemo(() => durationMsLabel(displayInMs, displayOutMs), [displayInMs, displayOutMs])

  const timingSummaryForAi = useMemo(() => {
    return [
      `Marked range ${formatMsRange(displayInMs, displayOutMs)}`,
      `Clip length ${clipDurationLabel}`,
      durationMs ? `Full film ${formatMsAsTimecode(durationMs)}` : "",
    ]
      .filter(Boolean)
      .join(" · ")
  }, [displayInMs, displayOutMs, clipDurationLabel, durationMs])

  const playheadFrameOrdinal = useMemo(
    () => frameOrdinalAtPlayhead(playheadMs, editorFps),
    [playheadMs, editorFps],
  )

  useEffect(() => {
    if (!playbackUrl || !videoReady || durationMs < 500) {
      setPreviewStripTiles([])
      setPreviewStripStatus("idle")
      return
    }
    let cancelled = false
    const run = async () => {
      setPreviewStripStatus("loading")
      setPreviewStripTiles([])
      try {
        const r = await fetch(`/api/teams/${teamId}/game-videos/${video.id}/preview-strip`)
        const data = (await r.json().catch(() => ({}))) as {
          tiles?: Array<{ tMs?: unknown; url?: unknown }>
        }
        if (cancelled) return
        const rawTiles = Array.isArray(data.tiles) ? data.tiles : []
        const mapped = rawTiles
          .filter((x) => x && typeof x === "object" && typeof x.url === "string")
          .map((x) => {
            const o = x as { tMs: unknown; url: string }
            const tMs = typeof o.tMs === "number" ? o.tMs : Number(o.tMs)
            return { tMs: Math.round(tMs), src: o.url }
          })
        if (mapped.length > 0) {
          setPreviewStripTiles(mapped)
          setPreviewStripStatus("ready")
          return
        }
      } catch {
        if (cancelled) return
      }

      const el = videoRef.current
      if (!el || cancelled) {
        setPreviewStripStatus("none")
        return
      }
      try {
        const cap = await captureClientPreviewStrip(el, durationMs)
        if (cancelled) return
        setPreviewStripTiles(cap.map((c) => ({ tMs: c.tMs, src: c.src })))
        setPreviewStripStatus(cap.length > 0 ? "ready" : "none")
      } catch {
        if (!cancelled) setPreviewStripStatus("error")
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [teamId, video.id, playbackUrl, durationMs, videoReady])

  const draftFormRef = useRef({
    clipTitle,
    clipDescription,
    clipTagsFree,
    quickTagsSelected,
    clipCategories,
    clipAttachedPlayerIds,
  })
  draftFormRef.current = {
    clipTitle,
    clipDescription,
    clipTagsFree,
    quickTagsSelected,
    clipCategories,
    clipAttachedPlayerIds,
  }

  const draftClipsRef = useRef(draftClips)
  draftClipsRef.current = draftClips

  const flushDraftFormIntoStore = useCallback(() => {
    if (highlightClipId || !selectedDraftId) return
    const id = selectedDraftId
    const f = draftFormRef.current
    setDraftClips((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              titleDraft: f.clipTitle,
              description: f.clipDescription,
              clipTagsFree: f.clipTagsFree,
              quickTagKeys: [...f.quickTagsSelected],
              categories: { ...f.clipCategories },
              attachedPlayerIds: [...f.clipAttachedPlayerIds],
            }
          : d,
      ),
    )
  }, [highlightClipId, selectedDraftId])

  useEffect(() => {
    if (highlightClipId || !selectedDraftId) return
    const d = draftClipsRef.current.find((x) => x.id === selectedDraftId)
    if (!d) return
    setClipTitle(d.titleDraft)
    setClipDescription(d.description)
    setClipTagsFree(d.clipTagsFree)
    setQuickTagsSelected(new Set(d.quickTagKeys))
    setClipCategories({ ...d.categories })
    setClipAttachedPlayerIds([...d.attachedPlayerIds])
    seekMs(d.startMs)
  }, [selectedDraftId, highlightClipId, seekMs])

  const selectDraftById = useCallback(
    (id: string) => {
      flushDraftFormIntoStore()
      stopPreview()
      stopMainPlay()
      setHighlightClipId(null)
      onSavedClipContextExit?.()
      setSelectedDraftId(id)
    },
    [flushDraftFormIntoStore, stopPreview, stopMainPlay, onSavedClipContextExit],
  )

  const timelineSegments = useMemo(() => {
    const drafts = draftClips.map((d) => ({
      id: d.id,
      kind: "draft" as const,
      startMs: d.startMs,
      endMs: d.endMs,
    }))
    const saved = clips.map((c) => ({
      id: c.id,
      kind: "saved" as const,
      startMs: c.start_ms,
      endMs: c.end_ms,
    }))
    return [...drafts, ...saved]
  }, [draftClips, clips])

  const selectedTimelineSegmentId = highlightClipId ?? selectedDraftId

  const resetMarks = () => {
    stopMainPlay()
    stopPreview()
    if (highlightClipId) {
      setInMs(0)
      setOutMs(Math.min(15000, durationSafe))
      seekMs(0)
      return
    }
    discardOpenMark()
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
    stopMainPlay()
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

  const resolveDraftForPersist = useCallback(
    (d: FilmDraftClip): FilmDraftClip => {
      if (d.id !== selectedDraftId) return d
      const f = draftFormRef.current
      return {
        ...d,
        titleDraft: f.clipTitle.trim() ? f.clipTitle : d.slotLabel,
        description: f.clipDescription,
        clipTagsFree: f.clipTagsFree,
        quickTagKeys: [...f.quickTagsSelected],
        categories: { ...f.clipCategories },
        attachedPlayerIds: [...f.clipAttachedPlayerIds],
      }
    },
    [selectedDraftId],
  )

  const saveDraftClipsToServer = useCallback(
    async (targetIds: string[]) => {
      if (!canCreateClips || !videoReady) return
      flushDraftFormIntoStore()
      await Promise.resolve()
      const unique = [...new Set(targetIds)]
      const snapshots = unique
        .map((id) => draftClipsRef.current.find((x) => x.id === id))
        .filter((x): x is FilmDraftClip => Boolean(x))
        .map(resolveDraftForPersist)
        .filter((d) => d.endMs > d.startMs + 80)

      if (snapshots.length === 0) {
        onError("Nothing valid to save yet — finish marking or checkboxes.")
        return
      }

      setClipSaving(true)
      onError(null)
      try {
        const savedIds: string[] = []
        for (const d of snapshots) {
          const tags = taggingEnabled ? mergeQuickAndFreeTags(new Set(d.quickTagKeys), d.clipTagsFree) : []
          const categories: Record<string, string> = {}
          if (d.categories.playType.trim()) categories.playType = d.categories.playType.trim()
          if (d.categories.situation.trim()) categories.situation = d.categories.situation.trim()
          if (d.categories.personnel.trim()) categories.personnel = d.categories.personnel.trim()
          if (d.categories.outcome.trim()) categories.outcome = d.categories.outcome.trim()

          const payload = {
            startMs: d.startMs,
            endMs: d.endMs,
            title: (d.titleDraft.trim() || d.slotLabel).slice(0, 500),
            description: d.description.trim() || null,
            tags,
            categories,
            playerIds: d.attachedPlayerIds,
          }

          const res = await fetch(`/api/teams/${teamId}/game-videos/${video.id}/clips`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not save clip")

          const newId =
            typeof (data as { clip?: { id?: unknown } }).clip?.id === "string"
              ? ((data as { clip: { id: string } }).clip.id as string)
              : null
          if (newId) savedIds.push(newId)
        }

        await onRefreshClips()
        const rm = new Set(snapshots.map((s) => s.id))
        setDraftClips((prev) => prev.filter((x) => !rm.has(x.id)))
        setBulkDraftIds((prev) => {
          const next = new Set(prev)
          snapshots.forEach((s) => next.delete(s.id))
          return next
        })
        if (selectedDraftId && rm.has(selectedDraftId)) {
          setSelectedDraftId(null)
          clearNewClipForm()
        }
        if (savedIds.length > 0) {
          setSessionClipIds((prev) => [...savedIds, ...prev.filter((x) => !savedIds.includes(x))])
        }
        setWorkflowStep(1)
        stopPreview()
      } catch (e) {
        onError(e instanceof Error ? e.message : "Clip save failed")
      } finally {
        setClipSaving(false)
      }
    },
    [
      teamId,
      video.id,
      canCreateClips,
      videoReady,
      taggingEnabled,
      onRefreshClips,
      selectedDraftId,
      resolveDraftForPersist,
      flushDraftFormIntoStore,
      onError,
      stopPreview,
    ],
  )

  const discardDraftClipsLocal = useCallback((targetIds: string[]) => {
    const rm = new Set(targetIds)
    flushDraftFormIntoStore()
    setDraftClips((prev) => prev.filter((x) => !rm.has(x.id)))
    setBulkDraftIds((prev) => {
      const next = new Set(prev)
      rm.forEach((id) => next.delete(id))
      return next
    })
    if (selectedDraftId && rm.has(selectedDraftId)) {
      setSelectedDraftId(null)
      clearNewClipForm()
    }
    stopPreview()
  }, [flushDraftFormIntoStore, selectedDraftId, stopPreview])

  const reorderDraftClip = useCallback(
    (id: string, dir: -1 | 1) => {
      flushDraftFormIntoStore()
      setDraftClips((prev) => {
        const idx = prev.findIndex((x) => x.id === id)
        if (idx < 0) return prev
        const j = idx + dir
        if (j < 0 || j >= prev.length) return prev
        const next = [...prev]
        const [row] = next.splice(idx, 1)
        next.splice(j, 0, row)
        return next.map((d, i) => ({ ...d, slotLabel: nextDraftSlotLabel(i) }))
      })
    },
    [flushDraftFormIntoStore],
  )

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
      flushDraftFormIntoStore()
      setSelectedDraftId(null)
      setMarkPhase("idle")
      setPendingStartMs(null)
      stopMainPlay()
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
    [seekMs, stopPreview, stopMainPlay, flushDraftFormIntoStore],
  )

  const onTimelineSegmentClick = useCallback(
    (id: string, kind: "draft" | "saved") => {
      stopPreview()
      stopMainPlay()
      if (kind === "saved") {
        const c = clips.find((x) => x.id === id)
        if (c) loadClipIntoEditor(c)
        return
      }
      selectDraftById(id)
    },
    [clips, loadClipIntoEditor, selectDraftById, stopPreview, stopMainPlay],
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
    stopMainPlay()
    savedClipSeekKeyRef.current = null
    initialClipAppliedRef.current = null
    setHighlightClipId(null)
    stopPreview()
    setDraftClips([])
    setSelectedDraftId(null)
    setBulkDraftIds(new Set())
    setMarkPhase("idle")
    setPendingStartMs(null)
    setWorkflowStep(1)
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
  }, [durationSafe, seekMs, stopPreview, stopMainPlay, onSavedClipContextExit])

  const previewSavedClip = async (c: ClipRow) => {
    stopMainPlay()
    previewCleanupRef.current?.()
    setSelectedDraftId(null)
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

  const workflowMode = Boolean(canCreateClips && videoReady && !highlightClipId)
  const showEditWorkflow = workflowMode && experienceMode === "edit"
  const showReviewSidebar = workflowMode && experienceMode === "review"
  const workflowModeRef = useRef(workflowMode)
  workflowModeRef.current = workflowMode
  const workflowStepRef = useRef(workflowStep)
  workflowStepRef.current = workflowStep
  const experienceModeRef = useRef(experienceMode)
  experienceModeRef.current = experienceMode

  useEffect(() => {
    if (!workflowMode) return
    if (draftClips.length === 0 && workflowStep > 1) setWorkflowStep(1)
  }, [workflowMode, draftClips.length, workflowStep])

  useEffect(() => {
    if (!workflowMode && experienceMode === "edit") setExperienceMode("review")
  }, [workflowMode, experienceMode])

  useEffect(() => {
    if (!workflowMode || workflowStep !== 3) return
    if (draftClips.length === 0) return
    if (!selectedDraftId || !draftClips.some((d) => d.id === selectedDraftId)) {
      selectDraftById(draftClips[0].id)
    }
  }, [workflowMode, workflowStep, draftClips, selectedDraftId, selectDraftById])

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
      } else if (e.code === "Enter" && (e.ctrlKey || e.metaKey) && canCreateClips && videoReady) {
        e.preventDefault()
        if (highlightClipId) {
          if (clipValid) void saveClipRequestRef.current(true)
        } else if (
          workflowModeRef.current &&
          experienceModeRef.current === "edit" &&
          workflowStepRef.current === 4 &&
          draftClipsRef.current.length > 0
        ) {
          void saveDraftClipsToServer(draftClipsRef.current.map((x) => x.id))
        }
      } else if (e.code === "KeyS" && e.shiftKey && (e.ctrlKey || e.metaKey) && canCreateClips && videoReady) {
        e.preventDefault()
        if (highlightClipId && clipValid) void saveClipRequestRef.current(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [
    clipValid,
    canCreateClips,
    videoReady,
    applyMarkStart,
    applyMarkEnd,
    highlightClipId,
    saveDraftClipsToServer,
  ])

  const draftQueueProps = {
    drafts: draftClips,
    selectedId: selectedDraftId,
    pulseDraftId: recentlyLoggedDraftId,
    bulkSelectedIds: bulkDraftIds,
    markPhase,
    pendingStartMs,
    onSelect: selectDraftById,
    onToggleBulk: (id: string, checked: boolean) => {
      setBulkDraftIds((prev) => {
        const next = new Set(prev)
        if (checked) next.add(id)
        else next.delete(id)
        return next
      })
    },
    onTitleChange: (id: string, title: string) => {
      setDraftClips((prev) => prev.map((d) => (d.id === id ? { ...d, titleDraft: title } : d)))
      if (selectedDraftId === id) setClipTitle(title)
    },
    onRemove: (id: string) => discardDraftClipsLocal([id]),
    onDiscardOpenMark: discardOpenMark,
    disabled: clipSaving,
  }

  const finalizePreviewClips = useMemo(
    () =>
      draftClips.map((d) => resolveDraftForPersist(d)).filter((d) => d.endMs > d.startMs + 80),
    [draftClips, resolveDraftForPersist],
  )

  const sortedSavedClips = useMemo(() => {
    return [...clips].sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : 0
      const tb = b.created_at ? Date.parse(b.created_at) : 0
      return tb - ta
    })
  }, [clips])

  const captureQuickClipProps = {
    enabled: canCreateClips && videoReady,
    savedClipEditing: false,
    draftWorkflow: true,
    hideDraftPersistActions: true,
    draftCount: draftClips.length,
    bulkSaveCount: bulkDraftIds.size,
    markPhase,
    previewActive,
    clipValid,
    previewClipAllowed,
    saving: clipSaving,
    fineTuneExpanded,
    onToggleFineTune: () => setFineTuneExpanded((v) => !v),
    onMarkStart: applyMarkStart,
    onMarkEnd: applyMarkEnd,
    mainPlayPrimaryLabel,
    mainPlayDisabled,
    mainPlayDisabledReason,
    playbackScopeHint,
    mainTransportPlaying: mainPlayActive && !videoPaused,
    onMainPlayToggle: () => void toggleMainPlay(),
    onPreview: () => void startPreview(),
    onStopPreview: stopPreview,
    onSaveClip: () => void saveClipRequest(false),
    onSaveAndContinue: () => void saveClipRequest(true),
    onResetMarks: resetMarks,
    onSkipBack5: skipBack5,
    onSkipForward5: skipForward5,
    onReplayClip: replayMarkedClip,
    onJumpToMarkStart: jumpMarkStart,
    onJumpToMarkEnd: jumpMarkEnd,
  }

  return (
    <TooltipProvider delayDuration={260} skipDelayDuration={100}>
      <FilmRoomShell>
        <div className="flex min-h-0 min-w-0 flex-[1_1_58%] flex-col gap-2 overflow-hidden">
        {highlightClipId && (
          <div
            className="shrink-0 rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 shadow-sm sm:px-3.5"
            role="status"
            aria-live="polite"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-primary">Editing saved clip</p>
                <p className="truncate text-[15px] font-semibold text-foreground">{clipTitle || "Untitled clip"}</p>
                <p className="mt-0.5 font-mono text-[12px] font-medium text-muted-foreground">
                  {formatMsRange(inMs, outMs)} · {clipDurationLabel}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 shrink-0 border border-border text-[13px] font-semibold"
                onClick={enterFullFilmMode}
              >
                Full film
              </Button>
            </div>
          </div>
        )}

        <header className="shrink-0 rounded-lg border border-border bg-muted/35 px-3 py-2 sm:px-3.5 xl:hidden">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Film Room</p>
          <h2 className="truncate text-lg font-bold tracking-tight text-foreground">{video.title || "Untitled film"}</h2>
        </header>

        {sessionClipIds.length > 0 && (
          <ClipSessionStrip
            clips={clips}
            sessionOrder={sessionClipIds}
            highlightClipId={highlightClipId}
            onSelectClip={(c) => loadClipIntoEditor(c)}
          />
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
        <FilmPlayerHero
          playbackUrl={playbackUrl}
          videoRef={videoRef as RefObject<HTMLVideoElement>}
          playbackKey={playbackUrl ?? ""}
          previewActive={previewActive}
          suppressNativeControls={previewActive || (mainPlayActive && !mainPlayFullFilm)}
          durationSafe={durationSafe}
          playheadMs={playheadMs}
          inMs={displayInMs}
          outMs={displayOutMs}
          clipDurationLabel={clipDurationLabel}
          timelineRef={timelineRef as RefObject<HTMLDivElement>}
          onLoadedMetadata={onVideoMeta}
          syncPlayhead={syncPlayhead}
          onTimelinePointerDown={pctPlay}
          fineTuneExpanded={fineTuneExpanded}
          onNudgePlayhead={nudgePlayhead}
          onNudgeIn={nudgeIn}
          onNudgeOut={nudgeOut}
          onSetInMs={setInMsFromTimeline}
          onSetOutMs={setOutMsFromTimeline}
          timelineSegments={timelineSegments}
          selectedTimelineSegmentId={selectedTimelineSegmentId}
          onTimelineSegmentClick={onTimelineSegmentClick}
          markingRangeLive={markPhase === "await_end"}
          editorFps={editorFps}
          onEditorFpsChange={(fps) => setEditorFps(normalizeFpsChoice(fps))}
          playheadFrameOrdinal={playheadFrameOrdinal}
          onStepPlayheadFrames={stepPlayheadFrames}
          onNudgeMarkInFrames={nudgeMarkInFrames}
          onNudgeMarkOutFrames={nudgeMarkOutFrames}
          videoOverlay={
            <FilmAnnotationOverlay
              activeTool={annotationTool}
              strokes={annotationStrokes}
              onStrokesChange={setAnnotationStrokes}
            />
          }
          chromeBelowVideo={
            <FilmAnnotationToolbar
              activeTool={annotationTool}
              onToolChange={setAnnotationTool}
              onUndo={() => setAnnotationStrokes((s) => s.slice(0, -1))}
              onClear={() => setAnnotationStrokes([])}
              canUndo={annotationStrokes.length > 0}
              hasInk={annotationStrokes.length > 0}
              disabled={!videoReady}
            />
          }
          belowScrubber={
            videoReady && playbackUrl ? (
              <FilmPreviewThumbnailLane
                durationMs={durationSafe}
                playheadMs={playheadMs}
                tiles={previewStripTiles}
                status={previewStripStatus}
                onSeekMs={(ms) => {
                  stopPreview()
                  stopMainPlay()
                  seekMs(ms)
                }}
              />
            ) : null
          }
        />
        </div>

        {!videoReady && (
          <div className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] font-medium text-amber-950 dark:text-amber-100">
            This film is still processing. Refresh in a moment — marking and clips unlock when status shows Ready in your
            library.
          </div>
        )}
        </div>

        <div className="flex w-full min-h-0 shrink-0 flex-col gap-2 overflow-hidden xl:w-[380px] xl:max-w-[400px] xl:self-stretch">
          {workflowMode ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
              <FilmRoomExperienceToggle
                mode={experienceMode}
                onModeChange={setExperienceMode}
                canEdit={canCreateClips}
                disabled={clipSaving}
              />

              {showReviewSidebar ? (
                <FilmRoomReviewSidebar
                  video={video}
                  clipsSorted={sortedSavedClips}
                  highlightClipId={highlightClipId}
                  sessionClipCount={sessionClipIds.length}
                  onLoadClip={(c) => loadClipIntoEditor(c)}
                  onPreviewClip={(c) => {
                    loadClipIntoEditor(c)
                    void previewSavedClip(c)
                  }}
                  teamId={teamId}
                  filmAttachedPlayerIds={filmAttachedPlayerIds}
                  onFilmAttachedPlayerIdsChange={
                    onFilmAttachedPlayerIdsChange
                      ? (ids) =>
                          onFilmAttachedPlayerIdsChange(ids).catch((e) =>
                            onError(e instanceof Error ? e.message : "Could not update film roster links"),
                          )
                      : undefined
                  }
                  filmRosterDisabled={clipSaving || !videoReady}
                />
              ) : null}

              {showEditWorkflow ? (
                <>
              <FilmWorkflowStepper
                step={workflowStep}
                draftCount={draftClips.length}
                disabled={clipSaving}
                onStepChange={(s) => {
                  if (draftClips.length === 0 && s > 1) return
                  setWorkflowStep(s)
                }}
              />
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-white/15 bg-[#0f172a]/95 p-2.5 shadow-sm">
                <div className="shrink-0 rounded-lg border border-white/15 bg-[#0b1220]/90 px-3 py-2">
                  <p className="text-[11px] font-bold uppercase text-sky-300">Film Room</p>
                  <p className="truncate text-[15px] font-bold text-white">{video.title || "Untitled film"}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-[13px] font-medium text-slate-200">
                    <span>Drafts: {draftClips.length}</span>
                    <span>Saved: {clips.length}</span>
                    <span>Session: {sessionClipIds.length}</span>
                  </div>
                </div>

                {workflowStep === 1 ? (
                  <CaptureStepPanel
                    canContinue={draftClips.length > 0}
                    onContinue={() => setWorkflowStep(2)}
                    quickClipProps={captureQuickClipProps}
                    draftQueueProps={draftQueueProps}
                  />
                ) : null}

                {workflowStep === 2 ? (
                  <ReviewStepPanel
                    drafts={draftClips}
                    selectedId={selectedDraftId}
                    onSelect={(id) => selectDraftById(id)}
                    onRemove={(id) => discardDraftClipsLocal([id])}
                    onMove={reorderDraftClip}
                    onBack={() => setWorkflowStep(1)}
                    onContinue={() => {
                      flushDraftFormIntoStore()
                      setWorkflowStep(3)
                    }}
                    disabled={clipSaving}
                  />
                ) : null}

                {workflowStep === 3 ? (
                  <NameTagStepPanel
                    drafts={draftClips}
                    selectedDraftId={selectedDraftId}
                    onSelectDraft={selectDraftById}
                    clipTitleInputRef={clipTitleInputRef}
                    clipTitle={clipTitle}
                    setClipTitle={setClipTitle}
                    clipAttachedPlayerIds={clipAttachedPlayerIds}
                    onClipAttachedPlayerIdsChange={setClipAttachedPlayerIds}
                    clipCategories={clipCategories}
                    setClipCategories={setClipCategories}
                    clipDescription={clipDescription}
                    setClipDescription={setClipDescription}
                    quickTagsSelected={quickTagsSelected}
                    toggleQuickTag={toggleQuickTag}
                    clipTagsFree={clipTagsFree}
                    setClipTagsFree={setClipTagsFree}
                    taggingEnabled={taggingEnabled}
                    aiVideoEnabled={aiVideoEnabled}
                    aiWorking={aiWorking}
                    onRunAiAssist={runAiAssist}
                    teamId={teamId}
                    videoReady={videoReady}
                    canCreateClips={canCreateClips}
                    onBack={() => setWorkflowStep(2)}
                    onContinue={() => {
                      flushDraftFormIntoStore()
                      setWorkflowStep(4)
                    }}
                  />
                ) : null}

                {workflowStep === 4 ? (
                  <FinalizeStepPanel
                    drafts={finalizePreviewClips}
                    taggingEnabled={taggingEnabled}
                    saving={clipSaving}
                    onFinalize={() => void saveDraftClipsToServer(draftClips.map((d) => d.id))}
                    onBack={() => setWorkflowStep(3)}
                  />
                ) : null}
              </div>

              {onFilmAttachedPlayerIdsChange ? (
                <FilmFullRosterLinksCard
                  teamId={teamId}
                  filmAttachedPlayerIds={filmAttachedPlayerIds}
                  onFilmAttachedPlayerIdsChange={(ids) =>
                    onFilmAttachedPlayerIdsChange(ids).catch((e) =>
                      onError(e instanceof Error ? e.message : "Could not update film roster links"),
                    )
                  }
                  disabled={clipSaving || !videoReady}
                />
              ) : null}

              <details className="shrink-0 rounded-xl border border-white/15 bg-[#0f172a]/90 p-2.5">
                <summary className="cursor-pointer text-[13px] font-semibold text-slate-100">
                  Saved clips on this film ({clips.length})
                </summary>
                <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto pr-0.5">
                  {sortedSavedClips.length === 0 ? (
                    <li className="rounded-lg border border-dashed border-white/15 px-3 py-6 text-center text-[13px] font-medium text-slate-300">
                      No clips saved yet.
                    </li>
                  ) : (
                    sortedSavedClips.map((c) => {
                      const active = highlightClipId === c.id
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => loadClipIntoEditor(c)}
                            className={cn(
                              "flex w-full flex-col rounded-lg px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                              active ? "bg-primary/15 ring-2 ring-primary/35" : "hover:bg-white/5",
                            )}
                          >
                            <span className="line-clamp-2 text-[13px] font-semibold text-white">{c.title?.trim() || "Untitled clip"}</span>
                            <span className="mt-0.5 font-mono text-[12px] tabular-nums text-slate-300">
                              {formatMsRange(c.start_ms, c.end_ms)}
                            </span>
                          </button>
                        </li>
                      )
                    })
                  )}
                </ul>
              </details>
                </>
              ) : null}

            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden rounded-xl border border-white/15 bg-[#0f172a]/95 p-2.5">
              {canCreateClips && videoReady ? (
                <QuickClipBar
                  enabled
                  savedClipEditing={!!highlightClipId}
                  draftWorkflow={!highlightClipId}
                  hideDraftPersistActions={false}
                  draftCount={draftClips.length}
                  bulkSaveCount={bulkDraftIds.size}
                  markPhase={markPhase}
                  onSaveDraftsSelected={() => {
                    const ids =
                      bulkDraftIds.size > 0 ? [...bulkDraftIds] : selectedDraftId ? [selectedDraftId] : []
                    if (ids.length === 0) {
                      onError("Select clips with the checkboxes, or click a draft in the list first.")
                      return
                    }
                    void saveDraftClipsToServer(ids)
                  }}
                  onSaveDraftsAll={() => void saveDraftClipsToServer(draftClips.map((d) => d.id))}
                  onDiscardDraftsSelected={() => {
                    const ids =
                      bulkDraftIds.size > 0 ? [...bulkDraftIds] : selectedDraftId ? [selectedDraftId] : []
                    if (ids.length === 0) {
                      onError("Select clips to remove from the queue.")
                      return
                    }
                    discardDraftClipsLocal(ids)
                  }}
                  onSaveDraftsAndContinue={() => {
                    void saveDraftClipsToServer(draftClips.map((d) => d.id)).then(() => {
                      requestAnimationFrame(() => clipTitleInputRef.current?.focus())
                    })
                  }}
                  previewActive={previewActive}
                  clipValid={clipValid}
                  previewClipAllowed={previewClipAllowed}
                  saving={clipSaving}
                  fineTuneExpanded={fineTuneExpanded}
                  onToggleFineTune={() => setFineTuneExpanded((v) => !v)}
                  onMarkStart={applyMarkStart}
                  onMarkEnd={applyMarkEnd}
                  mainPlayPrimaryLabel={mainPlayPrimaryLabel}
                  mainPlayDisabled={mainPlayDisabled}
                  mainPlayDisabledReason={mainPlayDisabledReason}
                  playbackScopeHint={playbackScopeHint}
                  mainTransportPlaying={mainPlayActive && !videoPaused}
                  onMainPlayToggle={() => void toggleMainPlay()}
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
              ) : null}

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
          filmAttachedPlayerIds={filmAttachedPlayerIds}
          onFilmAttachedPlayerIdsChange={
            onFilmAttachedPlayerIdsChange
              ? (ids) => {
                  void onFilmAttachedPlayerIdsChange(ids).catch((e) =>
                    onError(e instanceof Error ? e.message : "Could not update film roster links"),
                  )
                }
              : undefined
          }
          filmRosterLinksDisabled={clipSaving || !videoReady}
        />
            </div>
          )}
        </div>
      </FilmRoomShell>
    </TooltipProvider>
  )
}
