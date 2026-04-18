"use client"

import type { RefObject } from "react"
import { Film } from "lucide-react"
import {
  clampMs,
  formatMsAsTimecode,
  formatMsRange,
  parseLooseTimeToMs,
} from "@/lib/video/timecode"
import { Input } from "@/components/ui/input"

type Props = {
  playbackUrl: string | null
  videoRef: RefObject<HTMLVideoElement>
  playbackKey: string
  previewActive: boolean
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
}

const NUDGE_SMALL = 100
const NUDGE_LARGE = 1000

export function FilmPlayerHero({
  playbackUrl,
  videoRef,
  playbackKey,
  previewActive,
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
}: Props) {
  const pct = (ms: number) => Math.min(100, Math.max(0, (ms / durationSafe) * 100))

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-[#0a0f1a] shadow-lg ring-1 ring-black/5 dark:ring-white/10">
      <div className="relative aspect-video w-full bg-black">
        {playbackUrl ? (
          <video
            ref={videoRef}
            key={playbackKey}
            className="h-full w-full object-contain"
            controls={!previewActive}
            src={playbackUrl}
            preload="metadata"
            onLoadedMetadata={onLoadedMetadata}
            onClick={() => syncPlayhead()}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Loading your film…
          </div>
        )}
      </div>

      <div className="border-t border-white/10 bg-[#0f172a]/95 px-4 py-4 backdrop-blur-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-200">
            <Film className="h-4 w-4 shrink-0" aria-hidden />
            <span>Scrubber · range</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-200">
            <span>
              <span className="font-semibold text-slate-300">Now</span>{" "}
              <strong className="font-mono text-xl font-bold tabular-nums text-emerald-300 sm:text-2xl">
                {formatMsAsTimecode(playheadMs)}
              </strong>
            </span>
            <span className="hidden sm:inline text-slate-500">|</span>
            <span>
              <span className="font-semibold text-slate-300">Marked</span>{" "}
              <strong className="font-mono text-base font-bold tabular-nums text-sky-200 sm:text-lg">
                {formatMsRange(inMs, outMs)}
              </strong>
            </span>
            <span className="hidden sm:inline text-slate-500">|</span>
            <span>
              <span className="font-semibold text-slate-300">Clip length</span>{" "}
              <strong className="font-mono text-base font-bold tabular-nums text-amber-200 sm:text-lg">
                {clipDurationLabel}
              </strong>
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
          className="relative mb-3 h-14 cursor-pointer rounded-xl bg-slate-800/80 ring-2 ring-white/15 transition-shadow hover:ring-sky-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          onMouseDown={(e) => {
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
          <div
            className="pointer-events-none absolute bottom-0 top-0 rounded-xl bg-sky-500/30"
            style={{
              left: `${pct(inMs)}%`,
              width: `${Math.max(0, pct(outMs) - pct(inMs))}%`,
            }}
          />
          <div
            className="pointer-events-none absolute bottom-0 top-0 w-1 rounded-sm bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)]"
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
                    if (ms != null) onSetInMs(clampMs(ms, 0, outMs - 100))
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
                    if (ms != null) onSetOutMs(clampMs(ms, inMs + 100, durationSafe))
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
