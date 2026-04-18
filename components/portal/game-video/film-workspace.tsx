"use client"

import type { RefObject } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ClipRow, GameVideoRow } from "@/components/portal/game-video/game-video-types"
import { CoachFilmSidePanel } from "@/components/portal/game-video/coach-film-side-panel"
import { FilmRoomSessionRail } from "@/components/portal/game-video/film-room-session-rail"
import { FilmPlayerHero } from "@/components/portal/game-video/film-player-hero"
import { QuickClipBar } from "@/components/portal/game-video/quick-clip-bar"
import { ClipSessionStrip } from "@/components/portal/game-video/clip-session-strip"
import { DraftClipQueue } from "@/components/portal/game-video/draft-clip-queue"
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
import { ClipPlayerAttachmentField } from "@/components/portal/game-video/clip-player-attachment-field"
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
  const [mainPlayActive, setMainPlayActive] = useState(false)
  const [mainPlayFullFilm, setMainPlayFullFilm] = useState(false)
  const [videoPaused, setVideoPaused] = useState(true)

  const [reelClipIds, setReelClipIds] = useState<Set<string>>(new Set())
  /** Newest-first clip ids created in this film-room session (for quick recall without leaving the player). */
  const [sessionClipIds, setSessionClipIds] = useState<string[]>([])

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
    setDraftClips([])
    setSelectedDraftId(null)
    setBulkDraftIds(new Set())
    setMarkPhase("idle")
    setPendingStartMs(null)
    setPreviewStripTiles([])
    setPreviewStripStatus("idle")
    setRecentlyLoggedDraftId(null)
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
    setMainPlayActive(false)
    setMainPlayFullFilm(false)
    videoRef.current?.pause()
  }, [])

  /** Stops at end of film (full) or at out point (clip segment); separate from Preview clip loop */
  useEffect(() => {
    const el = videoRef.current
    if (!el || !mainPlayActive || durationSafe < 120) return

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
  }, [mainPlayActive, mainPlayFullFilm, displayOutMs, durationSafe, playbackUrl, stopMainPlay])

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
    setPreviewActive(false)
  }, [])

  const stopPreview = useCallback(() => {
    previewCleanupRef.current?.()
    previewCleanupRef.current = null
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
    setPreviewActive(true)
    el.currentTime = displayInMs / 1000
    try {
      await el.play()
    } catch {
      /* autoplay */
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

  const toggleMainPlay = useCallback(async () => {
    const el = videoRef.current
    if (!el || !videoReady) return

    if (mainPlayActive) {
      if (!el.paused) {
        el.pause()
        return
      }
      try {
        await el.play()
      } catch {
        /* autoplay */
      }
      return
    }

    if (clipSegmentPlayMode && !clipValid) return

    stopPreview()
    previewCleanupRef.current?.()
    previewCleanupRef.current = null

    if (clipSegmentPlayMode) {
      setMainPlayFullFilm(false)
      setMainPlayActive(true)
      el.currentTime = displayInMs / 1000
      try {
        await el.play()
      } catch {
        /* autoplay */
      }
      return
    }

    setMainPlayFullFilm(true)
    setMainPlayActive(true)
    try {
      await el.play()
    } catch {
      /* autoplay */
    }
  }, [videoReady, mainPlayActive, clipSegmentPlayMode, clipValid, displayInMs, stopPreview])

  const mainPlayPrimaryLabel =
    mainPlayActive && !videoPaused
      ? "Pause"
      : mainPlayActive && videoPaused
        ? "Resume"
        : clipSegmentPlayMode
          ? "Play clip"
          : "Play film"

  const mainPlayDisabled = !videoReady || (clipSegmentPlayMode && !clipValid)

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
        } else if (draftClipsRef.current.length > 0) {
          void saveDraftClipsToServer(draftClipsRef.current.map((x) => x.id))
        }
      } else if (e.code === "KeyS" && e.shiftKey && (e.ctrlKey || e.metaKey) && canCreateClips && videoReady) {
        e.preventDefault()
        if (highlightClipId) {
          if (clipValid) void saveClipRequestRef.current(false)
        } else {
          const bulk = bulkDraftIds.size > 0 ? [...bulkDraftIds] : selectedDraftId ? [selectedDraftId] : []
          if (bulk.length > 0) void saveDraftClipsToServer(bulk)
        }
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
    selectedDraftId,
    bulkDraftIds,
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

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
      <FilmRoomSessionRail
        video={video}
        clips={clips}
        sessionClipIds={sessionClipIds}
        filmAttachedPlayerIds={filmAttachedPlayerIds}
        highlightClipId={highlightClipId}
        canCreateClips={canCreateClips}
        videoReady={videoReady}
        draftWorkflowEnabled={canCreateClips && videoReady}
        draftQueue={draftQueueProps}
        onLoadSavedClip={loadClipIntoEditor}
      />

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
              Scrubber shows this clip’s range. Use <strong className="text-foreground">Play clip</strong> for a single pass or{" "}
              <strong className="text-foreground">Preview clip</strong> to loop while editing. Switch to full film mode for a new
              clip or to browse the whole game.
            </p>
          </div>
        )}

        <header className="rounded-xl border-2 border-border bg-muted/40 px-4 py-4 sm:px-6 xl:hidden">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Source film</p>
          <h2 className="mt-1 truncate text-2xl font-bold tracking-tight text-foreground">{video.title || "Untitled film"}</h2>
          <p className="mt-2 text-sm leading-snug text-slate-700 dark:text-slate-300">
            {highlightClipId
              ? "Film plays behind your saved clip — timeline range matches the clip below."
              : "Drag the scrubber or use the controls. Mark start → mark end for each play — drafts stack as you watch; save to the roster only when you choose."}
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

        {!videoReady && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
            This film is still processing. Refresh in a moment — marking and clips unlock when status shows Ready in your
            library.
          </div>
        )}

        {canCreateClips && videoReady && (
          <div className="xl:hidden">
            <DraftClipQueue
              drafts={draftClips}
              selectedId={selectedDraftId}
              pulseDraftId={recentlyLoggedDraftId}
              bulkSelectedIds={bulkDraftIds}
              markPhase={markPhase}
              pendingStartMs={pendingStartMs}
              onSelect={(id) => selectDraftById(id)}
              onToggleBulk={(id, checked) => {
                setBulkDraftIds((prev) => {
                  const next = new Set(prev)
                  if (checked) next.add(id)
                  else next.delete(id)
                  return next
                })
              }}
              onTitleChange={(id, title) => {
                setDraftClips((prev) => prev.map((d) => (d.id === id ? { ...d, titleDraft: title } : d)))
                if (selectedDraftId === id) setClipTitle(title)
              }}
              onRemove={(id) => discardDraftClipsLocal([id])}
              onDiscardOpenMark={discardOpenMark}
              disabled={clipSaving}
            />
          </div>
        )}

        <QuickClipBar
          enabled={canCreateClips && videoReady}
          savedClipEditing={!!highlightClipId}
          draftWorkflow={!highlightClipId}
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
