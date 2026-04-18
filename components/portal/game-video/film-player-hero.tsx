"use client"

import type { ReactNode, RefObject } from "react"
import { ChevronLeft, ChevronRight, Film } from "lucide-react"
import {
  clampMs,
  formatMsAsTimecode,
  formatMsRange,
  parseLooseTimeToMs,
} from "@/lib/video/timecode"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FilmInfoTip } from "@/components/portal/game-video/film-info-tip"
import { cn } from "@/lib/utils"
import {
  FILM_EDITOR_FPS_PRESETS,
  frameDurationMs,
  snapMsToFrameGrid,
} from "@/lib/video/frame-timing"

export type FilmTimelineSegment = {
  id: string
  kind: "draft" | "saved"
  startMs: number
  endMs: number
}

type Props = {
  playbackUrl: string | null
  videoRef: RefObject<HTMLVideoElement>
  playbackKey: string
  previewActive: boolean
  /** Hide native video controls while Braik-driven preview or main Play transport is active */
  suppressNativeControls?: boolean
  durationSafe: number
  playheadMs: number
  inMs: number
  outMs: number
  clipDurationLabel: string
  timelineRef: RefObject<HTMLDivElement>
  onLoadedMetadata: () => void
  syncPlayhead: () => void
  onTimelinePointerDown: (clientX: number) => void
  fineTuneExpanded: boolean
  onNudgePlayhead: (deltaMs: number) => void
  onNudgeIn: (deltaMs: number) => void
  onNudgeOut: (deltaMs: number) => void
  onSetInMs: (ms: number) => void
  onSetOutMs: (ms: number) => void
  /** Draft + saved clips shown as lane segments (click selects in workspace) */
  timelineSegments?: FilmTimelineSegment[]
  selectedTimelineSegmentId?: string | null
  onTimelineSegmentClick?: (id: string, kind: FilmTimelineSegment["kind"]) => void
  /** When marking end is pending, pulse the active work range */
  markingRangeLive?: boolean
  /** Nominal fps for frame snapping / stepping (coach-selectable). */
  editorFps: number
  onEditorFpsChange: (fps: number) => void
  playheadFrameOrdinal: number
  onStepPlayheadFrames: (deltaFrames: number) => void
  onNudgeMarkInFrames: (deltaFrames: number) => void
  onNudgeMarkOutFrames: (deltaFrames: number) => void
  /** Optional visual scan lane beneath the scrubber */
  belowScrubber?: ReactNode
  /** Optional strip under thumbnails (workflow status, draft summary, etc.) */
  timelineFooter?: ReactNode
  /** Overlay inside the video frame (e.g. telestration canvas) */
  videoOverlay?: ReactNode
  /** Toolbar or hints between the video frame and timeline (e.g. drawing tools) */
  chromeBelowVideo?: ReactNode
}

const NUDGE_SMALL = 100
const NUDGE_LARGE = 1000

export function FilmPlayerHero({
  playbackUrl,
  videoRef,
  playbackKey,
  previewActive,
  suppressNativeControls = false,
  durationSafe,
  playheadMs,
  inMs,
  outMs,
  clipDurationLabel,
  timelineRef,
  onLoadedMetadata,
  syncPlayhead,
  onTimelinePointerDown,
  fineTuneExpanded,
  onNudgePlayhead,
  onNudgeIn,
  onNudgeOut,
  onSetInMs,
  onSetOutMs,
  timelineSegments = [],
  selectedTimelineSegmentId = null,
  onTimelineSegmentClick,
  markingRangeLive = false,
  editorFps,
  onEditorFpsChange,
  playheadFrameOrdinal,
  onStepPlayheadFrames,
  onNudgeMarkInFrames,
  onNudgeMarkOutFrames,
  belowScrubber,
  timelineFooter,
  videoOverlay,
  chromeBelowVideo,
}: Props) {
  const pct = (ms: number) => Math.min(100, Math.max(0, (ms / durationSafe) * 100))
  const fd = frameDurationMs(editorFps)
  const fdLabel = fd < 10 ? fd.toFixed(2) : fd.toFixed(1)

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-[#0a0f1a] shadow-md ring-1 ring-black/5 dark:ring-white/10">
      <div className="relative mx-auto aspect-video w-full max-h-[min(40vh,340px)] bg-black xl:max-h-[min(50vh,520px)]">
        {playbackUrl ? (
          <video
            ref={videoRef}
            key={playbackKey}
            className="h-full w-full object-contain"
            playsInline
            controls={!previewActive && !suppressNativeControls}
            src={playbackUrl}
            preload="metadata"
            onLoadedMetadata={onLoadedMetadata}
            onClick={() => syncPlayhead()}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-medium text-slate-300">
            Loading your film…
          </div>
        )}
        {videoOverlay}
      </div>

      {chromeBelowVideo ? (
        <div className="border-t border-white/10 bg-[#0b1220]/90 px-2 py-1.5 sm:px-2">{chromeBelowVideo}</div>
      ) : null}

      <div className="border-t border-white/10 bg-[#0f172a]/95 px-2 py-1.5 backdrop-blur-sm sm:px-2.5">
        <div className="mb-1.5 grid gap-1.5 lg:grid-cols-[minmax(0,auto)_minmax(0,1fr)] lg:items-end">
          <div className="flex min-w-0 items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-100 sm:text-[13px]">
            <Film className="h-4 w-4 shrink-0" aria-hidden />
            <span>Timeline</span>
            <FilmInfoTip label="Using the timeline" side="bottom" className="text-slate-300 hover:bg-white/10 hover:text-white focus-visible:ring-offset-[#0f172a]">
              <p>Click or drag to seek the playhead. Orange bands are drafts; green are saved clips — click to select.</p>
            </FilmInfoTip>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-slate-100 sm:gap-x-3 sm:text-[13px]">
            <span>
              <span className="font-semibold text-slate-200">Now</span>{" "}
              <strong className="font-mono text-base font-bold tabular-nums text-emerald-300 sm:text-lg">
                {formatMsAsTimecode(playheadMs)}
              </strong>
            </span>
            <span className="hidden sm:inline text-slate-500">|</span>
            <span>
              <span className="font-semibold text-slate-200">Marked</span>{" "}
              <strong className="font-mono text-sm font-bold tabular-nums text-sky-200 sm:text-base">
                {formatMsRange(inMs, outMs)}
              </strong>
            </span>
            <span className="hidden sm:inline text-slate-500">|</span>
            <span>
              <span className="font-semibold text-slate-200">Clip length</span>{" "}
              <strong className="font-mono text-sm font-bold tabular-nums text-amber-200 sm:text-base">
                {clipDurationLabel}
              </strong>
            </span>
          </div>
        </div>

        <div className="mb-1.5 flex flex-col gap-1.5 rounded-lg border border-white/15 bg-slate-900/55 px-2 py-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-300">Frames</span>
            <FilmInfoTip label="Frame stepping and FPS" side="bottom" className="text-slate-400 hover:bg-white/10 hover:text-slate-100 focus-visible:ring-offset-[#0f172a]">
              <p>
                Step the playhead one frame at a time. <strong className="text-foreground">Nominal FPS</strong> sets the snap grid
                for marks and trim (~{fdLabel} ms per frame at current settings).
              </p>
            </FilmInfoTip>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 gap-1 border border-white/20 bg-slate-800 px-3 text-[13px] font-semibold text-white shadow-sm"
              onClick={() => onStepPlayheadFrames(-1)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Prev frame
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 gap-1 border border-white/20 bg-slate-800 px-3 text-[13px] font-semibold text-white shadow-sm"
              onClick={() => onStepPlayheadFrames(1)}
            >
              Next frame
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-slate-200">
            <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-300">
              Nominal FPS
              <select
                className="rounded-md border border-white/20 bg-slate-900 px-2 py-1 font-mono text-sm font-semibold text-white"
                value={editorFps}
                onChange={(e) => onEditorFpsChange(Number(e.target.value))}
              >
                {FILM_EDITOR_FPS_PRESETS.map((fps) => (
                  <option key={fps} value={fps}>
                    {fps}
                  </option>
                ))}
              </select>
            </label>
            <span className="hidden sm:inline text-slate-600">·</span>
            <span className="font-mono text-slate-300">
              Frame <strong className="text-emerald-300">{playheadFrameOrdinal}</strong>
              <span className="ml-1 text-slate-500">(~{fdLabel} ms)</span>
            </span>
          </div>
        </div>

        <div
          ref={timelineRef}
          role="slider"
          aria-label="Scrub film"
          aria-valuenow={playheadMs}
          aria-valuemin={0}
          aria-valuemax={durationSafe}
          tabIndex={0}
          className="relative mb-1.5 h-10 cursor-pointer rounded-lg bg-slate-800/90 ring-2 ring-white/20 transition-shadow hover:ring-sky-400/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 sm:h-11"
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest("[data-timeline-segment]")) return
            onTimelinePointerDown(e.clientX)
            const move = (ev: MouseEvent) => onTimelinePointerDown(ev.clientX)
            const up = () => {
              window.removeEventListener("mousemove", move)
              window.removeEventListener("mouseup", up)
            }
            window.addEventListener("mousemove", move)
            window.addEventListener("mouseup", up)
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") onNudgePlayhead(-NUDGE_LARGE)
            if (e.key === "ArrowRight") onNudgePlayhead(NUDGE_LARGE)
          }}
        >
          {timelineSegments.map((seg) => {
            const left = pct(seg.startMs)
            const w = Math.max(0, pct(seg.endMs) - left)
            const sel = seg.id === selectedTimelineSegmentId
            return (
              <button
                key={`${seg.kind}-${seg.id}`}
                type="button"
                data-timeline-segment
                title={seg.kind === "draft" ? "Draft clip — click to select" : "Saved clip — click to open"}
                className={cn(
                  "absolute bottom-0 top-0 z-[1] rounded-xl transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
                  seg.kind === "draft" ? "bg-amber-400/35 hover:bg-amber-400/45" : "bg-emerald-500/25 hover:bg-emerald-500/35",
                  sel && "ring-2 ring-amber-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]",
                )}
                style={{ left: `${left}%`, width: `${w}%` }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onTimelineSegmentClick?.(seg.id, seg.kind)
                }}
              />
            )
          })}
          <div
            className={cn(
              "pointer-events-none absolute bottom-0 top-0 z-[2] rounded-xl bg-sky-500/40",
              markingRangeLive && "animate-pulse bg-sky-400/45",
            )}
            style={{
              left: `${pct(inMs)}%`,
              width: `${Math.max(0, pct(outMs) - pct(inMs))}%`,
            }}
          />
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-[4] w-1 rounded-sm bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)]"
            style={{ left: `${pct(playheadMs)}%`, transform: "translateX(-50%)" }}
          />
          <div
            className="pointer-events-none absolute bottom-0 top-1 w-1 rounded-sm bg-sky-400"
            style={{ left: `${pct(inMs)}%`, transform: "translateX(-50%)" }}
          />
          <div
            className="pointer-events-none absolute bottom-0 top-1 w-1 rounded-sm bg-amber-400"
            style={{ left: `${pct(outMs)}%`, transform: "translateX(-50%)" }}
          />
        </div>

        {belowScrubber}

        {timelineFooter ? (
          <div className="border-t border-white/10 bg-[#0c1424]/95 px-2 py-2 sm:px-2.5">{timelineFooter}</div>
        ) : null}

        {fineTuneExpanded && (
          <div className="space-y-3 border-t border-white/10 pt-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Fine tune (optional)
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Playhead
              </span>
              <button
                type="button"
                className="rounded-lg border border-white/15 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
                onClick={() => onNudgePlayhead(-NUDGE_LARGE)}
              >
                −1s
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/15 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
                onClick={() => onNudgePlayhead(-NUDGE_SMALL)}
              >
                −0.1s
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/15 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
                onClick={() => onNudgePlayhead(NUDGE_SMALL)}
              >
                +0.1s
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/15 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
                onClick={() => onNudgePlayhead(NUDGE_LARGE)}
              >
                +1s
              </button>
              <button
                type="button"
                className="rounded-lg border border-violet-500/25 bg-violet-950/35 px-2.5 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-950/55"
                onClick={() => onStepPlayheadFrames(-1)}
              >
                −1 fr
              </button>
              <button
                type="button"
                className="rounded-lg border border-violet-500/25 bg-violet-950/35 px-2.5 py-1.5 text-xs font-semibold text-violet-100 hover:bg-violet-950/55"
                onClick={() => onStepPlayheadFrames(1)}
              >
                +1 fr
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="mr-1 self-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Trim start
              </span>
              <button
                type="button"
                className="rounded-lg border border-white/15 bg-slate-800/80 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                onClick={() => onNudgeIn(-NUDGE_SMALL)}
              >
                −
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/15 bg-slate-800/80 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                onClick={() => onNudgeIn(NUDGE_SMALL)}
              >
                +
              </button>
              <button
                type="button"
                className="rounded-lg border border-violet-500/30 bg-violet-950/40 px-2 py-1 text-[11px] font-semibold text-violet-100 hover:bg-violet-950/70"
                onClick={() => onNudgeMarkInFrames(-1)}
                title={`Trim start −1 frame (~${fdLabel} ms)`}
              >
                −1 fr
              </button>
              <button
                type="button"
                className="rounded-lg border border-violet-500/30 bg-violet-950/40 px-2 py-1 text-[11px] font-semibold text-violet-100 hover:bg-violet-950/70"
                onClick={() => onNudgeMarkInFrames(1)}
                title={`Trim start +1 frame (~${fdLabel} ms)`}
              >
                +1 fr
              </button>
              <span className="ml-3 self-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Trim end
              </span>
              <button
                type="button"
                className="rounded-lg border border-white/15 bg-slate-800/80 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                onClick={() => onNudgeOut(-NUDGE_SMALL)}
              >
                −
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/15 bg-slate-800/80 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                onClick={() => onNudgeOut(NUDGE_SMALL)}
              >
                +
              </button>
              <button
                type="button"
                className="rounded-lg border border-violet-500/30 bg-violet-950/40 px-2 py-1 text-[11px] font-semibold text-violet-100 hover:bg-violet-950/70"
                onClick={() => onNudgeMarkOutFrames(-1)}
                title={`Trim end −1 frame (~${fdLabel} ms)`}
              >
                −1 fr
              </button>
              <button
                type="button"
                className="rounded-lg border border-violet-500/30 bg-violet-950/40 px-2 py-1 text-[11px] font-semibold text-violet-100 hover:bg-violet-950/70"
                onClick={() => onNudgeMarkOutFrames(1)}
                title={`Trim end +1 frame (~${fdLabel} ms)`}
              >
                +1 fr
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Start time
                </label>
                <Input
                  className="mt-1 border-slate-600 bg-slate-900/80 font-mono text-sm text-slate-100"
                  value={formatMsAsTimecode(inMs)}
                  onChange={(e) => {
                    const ms = parseLooseTimeToMs(e.target.value)
                    if (ms != null) {
                      const q = snapMsToFrameGrid(clampMs(ms, 0, outMs - 100), editorFps)
                      onSetInMs(q)
                    }
                  }}
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">End time</label>
                <Input
                  className="mt-1 border-slate-600 bg-slate-900/80 font-mono text-sm text-slate-100"
                  value={formatMsAsTimecode(outMs)}
                  onChange={(e) => {
                    const ms = parseLooseTimeToMs(e.target.value)
                    if (ms != null) {
                      const q = snapMsToFrameGrid(clampMs(ms, inMs + 100, durationSafe), editorFps)
                      onSetOutMs(q)
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
