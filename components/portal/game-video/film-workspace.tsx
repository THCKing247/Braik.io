"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ChevronDown,
  ChevronRight,
  Film,
  Loader2,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sparkles,
  Square,
  Trash2,
  Wand2,
} from "lucide-react"
import type { ClipRow, GameVideoRow } from "@/components/portal/game-video/game-video-types"
import {
  clampMs,
  durationMsLabel,
  formatMsAsTimecode,
  formatMsRange,
  parseLooseTimeToMs,
} from "@/lib/video/timecode"

const NUDGE_SMALL = 100
const NUDGE_LARGE = 1000

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
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const timelineRef = useRef<HTMLDivElement | null>(null)

  const [durationMs, setDurationMs] = useState(0)
  const [playheadMs, setPlayheadMs] = useState(0)
  const [inMs, setInMs] = useState(0)
  const [outMs, setOutMs] = useState(0)

  const [clipTitle, setClipTitle] = useState("")
  const [clipDescription, setClipDescription] = useState("")
  const [clipTags, setClipTags] = useState("")
  const [clipCategories, setClipCategories] = useState({
    playType: "",
    situation: "",
    personnel: "",
    outcome: "",
  })

  const [previewActive, setPreviewActive] = useState(false)
  const [highlightClipId, setHighlightClipId] = useState<string | null>(null)
  const [clipSaving, setClipSaving] = useState(false)
  const [aiWorking, setAiWorking] = useState(false)
  const [aiOpen, setAiOpen] = useState(true)

  const durationSafe = durationMs > 0 ? durationMs : 1

  useEffect(() => {
    setInMs(0)
    setOutMs(0)
    setPlayheadMs(0)
    setPreviewActive(false)
    setHighlightClipId(null)
    setClipTitle("")
    setClipDescription("")
    setClipTags("")
    setClipCategories({ playType: "", situation: "", personnel: "", outcome: "" })
  }, [video.id])

  const onVideoMeta = () => {
    const el = videoRef.current
    if (!el || !Number.isFinite(el.duration)) return
    const d = Math.floor(el.duration * 1000)
    setDurationMs(d)
    setOutMs((prev) => (prev > 0 ? clampMs(prev, 0, d) : Math.min(15000, d)))
    setInMs(0)
    if (highlightClipId) return
    setPlayheadMs(0)
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
        el.currentTime = inMs / 1000
      }
    }
    el.addEventListener("timeupdate", onTu)
    return () => el.removeEventListener("timeupdate", onTu)
  }, [previewActive, inMs, outMs, playbackUrl])

  const seekMs = (ms: number) => {
    const el = videoRef.current
    if (!el) return
    const x = clampMs(ms, 0, durationSafe)
    el.currentTime = x / 1000
    setPlayheadMs(x)
  }

  const startPreview = async () => {
    const el = videoRef.current
    if (!el || outMs <= inMs) return
    setPreviewActive(true)
    el.currentTime = inMs / 1000
    try {
      await el.play()
    } catch {
      /* autoplay policies */
    }
  }

  const stopPreview = () => {
    const el = videoRef.current
    setPreviewActive(false)
    el?.pause()
  }

  const pct = (ms: number) => Math.min(100, Math.max(0, (ms / durationSafe) * 100))

  const onTimelinePointer = (clientX: number) => {
    const el = timelineRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    seekMs(Math.floor(ratio * durationSafe))
  }

  const applySetIn = () => setInMs(clampMs(playheadMs, 0, durationSafe))
  const applySetOut = () => setOutMs(clampMs(playheadMs, inMs + 100, durationSafe))

  useEffect(() => {
    if (outMs <= inMs) setOutMs(clampMs(inMs + 500, 0, durationSafe))
  }, [inMs, outMs, durationSafe])

  const jumpIn = () => seekMs(inMs)
  const jumpOut = () => seekMs(outMs)

  const nudgePlayhead = (deltaMs: number) => seekMs(playheadMs + deltaMs)
  const nudgeIn = (d: number) => setInMs(clampMs(inMs + d, 0, Math.max(0, outMs - 100)))
  const nudgeOut = (d: number) => setOutMs(clampMs(outMs + d, Math.min(inMs + 100, durationSafe), durationSafe))

  const clipDurationLabel = useMemo(() => durationMsLabel(inMs, outMs), [inMs, outMs])

  const timingSummaryForAi = useMemo(() => {
    return [
      `In ${formatMsAsTimecode(inMs)}, Out ${formatMsAsTimecode(outMs)}`,
      `Duration ${clipDurationLabel}`,
      durationMs ? `Film length ${formatMsAsTimecode(durationMs)}` : "",
    ]
      .filter(Boolean)
      .join(" · ")
  }, [inMs, outMs, clipDurationLabel, durationMs])

  const runAiAssist = async () => {
    if (!aiVideoEnabled) return
    const notes = clipDescription.trim() || clipTitle.trim()
    if (!notes) {
      onError("Add coaching notes for the assistant (what happens on this clip).")
      return
    }
    setAiWorking(true)
    onError(null)
    try {
      const res = await fetch(`/api/teams/${teamId}/video-clips/ai-suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes,
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
        setClipTags(data.suggestedTags.join(", "))
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

  const saveClip = async () => {
    if (!canCreateClips || video.upload_status !== "ready") return
    if (outMs <= inMs) {
      onError("Out point must be after In point.")
      return
    }
    setClipSaving(true)
    onError(null)
    try {
      const tags: string[] = []
      if (taggingEnabled && clipTags.trim()) {
        tags.push(...clipTags.split(",").map((t) => t.trim()).filter(Boolean))
      }
      const categories: Record<string, string> = {}
      if (clipCategories.playType.trim()) categories.playType = clipCategories.playType.trim()
      if (clipCategories.situation.trim()) categories.situation = clipCategories.situation.trim()
      if (clipCategories.personnel.trim()) categories.personnel = clipCategories.personnel.trim()
      if (clipCategories.outcome.trim()) categories.outcome = clipCategories.outcome.trim()

      const res = await fetch(`/api/teams/${teamId}/game-videos/${video.id}/clips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startMs: inMs,
          endMs: outMs,
          title: clipTitle.trim() || "Clip",
          description: clipDescription.trim() || null,
          tags,
          categories,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Could not save clip")
      await onRefreshClips()
      setClipTitle("")
      setClipDescription("")
      setClipTags("")
      setClipCategories({ playType: "", situation: "", personnel: "", outcome: "" })
      stopPreview()
    } catch (e) {
      onError(e instanceof Error ? e.message : "Clip save failed")
    } finally {
      setClipSaving(false)
    }
  }

  const deleteClip = async (clipId: string) => {
    if (!confirm("Remove this clip from the reel?")) return
    try {
      const res = await fetch(`/api/teams/${teamId}/game-videos/${video.id}/clips/${clipId}`, {
        method: "DELETE",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Delete failed")
      if (highlightClipId === clipId) setHighlightClipId(null)
      await onRefreshClips()
    } catch (e) {
      onError(e instanceof Error ? e.message : "Delete failed")
    }
  }

  const loadClipIntoEditor = (c: ClipRow) => {
    setHighlightClipId(c.id)
    setInMs(c.start_ms)
    setOutMs(c.end_ms)
    setClipTitle(c.title || "")
    setClipDescription(c.description || "")
    setClipTags(Array.isArray(c.tags) ? c.tags.join(", ") : "")
    const mc = c.metadata?.categories
    setClipCategories({
      playType: mc?.playType ?? "",
      situation: mc?.situation ?? "",
      personnel: mc?.personnel ?? "",
      outcome: mc?.outcome ?? "",
    })
    seekMs(c.start_ms)
    stopPreview()
  }

  const previewSavedClip = async (c: ClipRow) => {
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
        el.removeEventListener("timeupdate", check)
        setPreviewActive(false)
      }
    }
    el.addEventListener("timeupdate", check)
  }

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      {/* Hero player */}
      <section className="overflow-hidden rounded-2xl border border-border bg-[#0a0f1a] shadow-lg ring-1 ring-black/5 dark:ring-white/10">
        <div className="relative aspect-video w-full bg-black">
          {playbackUrl ? (
            <video
              ref={videoRef}
              key={playbackUrl}
              className="h-full w-full object-contain"
              controls={!previewActive}
              src={playbackUrl}
              preload="metadata"
              onLoadedMetadata={onVideoMeta}
              onClick={() => syncPlayhead()}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Preparing secure playback…
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="border-t border-white/10 bg-[#0f172a]/95 px-4 py-4 backdrop-blur-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span className="flex items-center gap-2 font-medium uppercase tracking-wide text-slate-300">
              <Film className="h-3.5 w-3.5" aria-hidden />
              Timeline
            </span>
            <span className="font-mono tabular-nums text-slate-300">
              Playhead <span className="text-emerald-400">{formatMsAsTimecode(playheadMs)}</span>
              <span className="mx-2 text-slate-600">|</span>
              Range{" "}
              <span className="text-sky-400">{formatMsRange(inMs, outMs)}</span>
              <span className="mx-2 text-slate-600">·</span>
              Clip <span className="text-amber-300">{clipDurationLabel}</span>
            </span>
          </div>

          <div
            ref={timelineRef}
            role="slider"
            aria-valuenow={playheadMs}
            aria-valuemin={0}
            aria-valuemax={durationSafe}
            tabIndex={0}
            className="relative mb-4 h-10 cursor-pointer rounded-lg bg-slate-800/80 ring-1 ring-white/10"
            onMouseDown={(e) => {
              onTimelinePointer(e.clientX)
              const move = (ev: MouseEvent) => onTimelinePointer(ev.clientX)
              const up = () => {
                window.removeEventListener("mousemove", move)
                window.removeEventListener("mouseup", up)
              }
              window.addEventListener("mousemove", move)
              window.addEventListener("mouseup", up)
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") nudgePlayhead(-NUDGE_LARGE)
              if (e.key === "ArrowRight") nudgePlayhead(NUDGE_LARGE)
            }}
          >
            {/* Range highlight */}
            <div
              className="pointer-events-none absolute bottom-0 top-0 bg-sky-500/25"
              style={{
                left: `${pct(inMs)}%`,
                width: `${Math.max(0, pct(outMs) - pct(inMs))}%`,
              }}
            />
            {/* Playhead */}
            <div
              className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
              style={{ left: `${pct(playheadMs)}%` }}
            />
            {/* In / out ticks */}
            <div
              className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-sky-400/90"
              style={{ left: `${pct(inMs)}%` }}
            />
            <div
              className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-amber-400/90"
              style={{ left: `${pct(outMs)}%` }}
            />
          </div>

          {canCreateClips && video.upload_status === "ready" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" className="h-9 bg-slate-700 text-white hover:bg-slate-600" onClick={applySetIn}>
                  Set In
                </Button>
                <Button type="button" size="sm" variant="secondary" className="h-9 bg-slate-700 text-white hover:bg-slate-600" onClick={applySetOut}>
                  Set Out
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-9 border-slate-600 text-slate-200" onClick={jumpIn}>
                  <SkipBack className="mr-1 h-3.5 w-3.5" />
                  Jump In
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-9 border-slate-600 text-slate-200" onClick={jumpOut}>
                  <SkipForward className="mr-1 h-3.5 w-3.5" />
                  Jump Out
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="mr-1 self-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Playhead
                </span>
                <Button type="button" size="sm" variant="ghost" className="h-8 text-slate-300" onClick={() => nudgePlayhead(-NUDGE_LARGE)}>
                  −1s
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 text-slate-300" onClick={() => nudgePlayhead(-NUDGE_SMALL)}>
                  −0.1s
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 text-slate-300" onClick={() => nudgePlayhead(NUDGE_SMALL)}>
                  +0.1s
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 text-slate-300" onClick={() => nudgePlayhead(NUDGE_LARGE)}>
                  +1s
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Trim In</span>
                <Button type="button" size="sm" variant="ghost" className="h-8 text-slate-300" onClick={() => nudgeIn(-NUDGE_SMALL)}>
                  −
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 text-slate-300" onClick={() => nudgeIn(NUDGE_SMALL)}>
                  +
                </Button>
                <span className="ml-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Trim Out</span>
                <Button type="button" size="sm" variant="ghost" className="h-8 text-slate-300" onClick={() => nudgeOut(-NUDGE_SMALL)}>
                  −
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-8 text-slate-300" onClick={() => nudgeOut(NUDGE_SMALL)}>
                  +
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
                {!previewActive ? (
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 bg-emerald-600 text-white hover:bg-emerald-500"
                    onClick={() => void startPreview()}
                  >
                    <Play className="mr-1.5 h-4 w-4" />
                    Preview clip range
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="secondary" className="h-9" onClick={stopPreview}>
                    <Square className="mr-1.5 h-4 w-4" />
                    Stop preview
                  </Button>
                )}
                <p className="self-center text-[11px] text-slate-500">
                  Preview loops In→Out. Full player controls stay available when preview is off.
                </p>
              </div>

              {/* Precision inputs (secondary to timeline) */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">In point</label>
                  <Input
                    className="mt-1 border-slate-600 bg-slate-900/80 font-mono text-sm text-slate-100"
                    value={formatMsAsTimecode(inMs)}
                    onChange={(e) => {
                      const ms = parseLooseTimeToMs(e.target.value)
                      if (ms != null) setInMs(clampMs(ms, 0, outMs - 100))
                    }}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Out point</label>
                  <Input
                    className="mt-1 border-slate-600 bg-slate-900/80 font-mono text-sm text-slate-100"
                    value={formatMsAsTimecode(outMs)}
                    onChange={(e) => {
                      const ms = parseLooseTimeToMs(e.target.value)
                      if (ms != null) setOutMs(clampMs(ms, inMs + 100, durationSafe))
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Metadata + AI */}
      {canCreateClips && video.upload_status === "ready" && (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground">Clip details</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Title and notes drive search and the assistant. Times are controlled from the timeline above.
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Title</label>
                  <Input className="mt-1" value={clipTitle} onChange={(e) => setClipTitle(e.target.value)} placeholder="e.g. Counter OT — TD" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Coaching notes</label>
                  <textarea
                    className="mt-1 flex min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={clipDescription}
                    onChange={(e) => setClipDescription(e.target.value)}
                    placeholder="What happens on this clip — personnel, motion, result…"
                  />
                </div>
                {taggingEnabled && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Tags</label>
                    <Input
                      className="mt-1"
                      value={clipTags}
                      onChange={(e) => setClipTags(e.target.value)}
                      placeholder="comma-separated"
                    />
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Play type</label>
                    <Input
                      className="mt-1"
                      value={clipCategories.playType}
                      onChange={(e) => setClipCategories((o) => ({ ...o, playType: e.target.value }))}
                      placeholder="e.g. Inside zone"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Situation</label>
                    <Input
                      className="mt-1"
                      value={clipCategories.situation}
                      onChange={(e) => setClipCategories((o) => ({ ...o, situation: e.target.value }))}
                      placeholder="e.g. Red zone"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Personnel</label>
                    <Input
                      className="mt-1"
                      value={clipCategories.personnel}
                      onChange={(e) => setClipCategories((o) => ({ ...o, personnel: e.target.value }))}
                      placeholder="e.g. 11 personnel"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Outcome</label>
                    <Input
                      className="mt-1"
                      value={clipCategories.outcome}
                      onChange={(e) => setClipCategories((o) => ({ ...o, outcome: e.target.value }))}
                      placeholder="e.g. Explosive"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="button" onClick={() => void saveClip()} disabled={clipSaving}>
                    {clipSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save to reel
                  </Button>
                  {canDeleteVideo && (
                    <Button type="button" variant="outline" onClick={() => void onDeleteVideo()}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete film
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border bg-gradient-to-b from-primary/5 to-card p-5 shadow-sm ring-1 ring-primary/10">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => setAiOpen((o) => !o)}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Wand2 className="h-4 w-4 text-primary" aria-hidden />
                  Breakdown assistant
                </span>
                {aiOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Suggests titles, descriptions, tags, and category labels from your notes and clip timing — not from
                automatic video understanding. Transcripts and vision models can plug in here later.
              </p>
              {aiOpen && (
                <div className="mt-4 space-y-3">
                  <details className="rounded-lg border border-border bg-background/80 p-3 text-xs">
                    <summary className="cursor-pointer font-medium text-foreground">Future analysis hooks</summary>
                    <p className="mt-2 text-muted-foreground">
                      Planned: transcript-aligned labels, OCR on scorebug, detector-backed play clustering. Jobs will use
                      the same clip record and metadata fields.
                    </p>
                  </details>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    disabled={!aiVideoEnabled || aiWorking}
                    onClick={() => void runAiAssist()}
                  >
                    {aiWorking ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Run assistant
                  </Button>
                  {!aiVideoEnabled && (
                    <p className="text-xs text-amber-800 dark:text-amber-200">AI video features are off for this team.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Saved clips */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Clip reel</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {clips.length} highlight{clips.length === 1 ? "" : "s"} on this film
            </p>
          </div>
        </div>
        {clips.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            No clips yet — mark In/Out on the timeline and save.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {clips.map((c) => (
              <li
                key={c.id}
                className={`flex flex-col rounded-xl border p-4 transition-colors ${
                  highlightClipId === c.id
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border bg-background hover:bg-muted/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{c.title || "Untitled clip"}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{formatMsRange(c.start_ms, c.end_ms)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Duration {durationMsLabel(c.start_ms, c.end_ms)}
                    </p>
                  </div>
                </div>
                {c.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
                )}
                {taggingEnabled && Array.isArray(c.tags) && c.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.tags.slice(0, 6).map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {c.metadata?.categories && Object.keys(c.metadata.categories).length > 0 && (
                  <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                    {Object.entries(c.metadata.categories).map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="font-medium capitalize text-foreground/80">{k}</dt>
                        <dd className="truncate">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button type="button" variant="secondary" size="sm" className="h-8 text-xs" onClick={() => loadClipIntoEditor(c)}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    Load in editor
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => void previewSavedClip(c)}>
                    <Play className="mr-1 h-3.5 w-3.5" />
                    Preview
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-destructive hover:text-destructive"
                    onClick={() => void deleteClip(c.id)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
