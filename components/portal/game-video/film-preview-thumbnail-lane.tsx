"use client"

import { useMemo } from "react"
import { Loader2 } from "lucide-react"
export type PreviewTile = { tMs: number; src: string }

type Props = {
  durationMs: number
  playheadMs: number
  tiles: PreviewTile[]
  status: "idle" | "loading" | "ready" | "error" | "none"
  onSeekMs: (ms: number) => void
}

export function FilmPreviewThumbnailLane({ durationMs, playheadMs, tiles, status, onSeekMs }: Props) {
  const durationSafe = durationMs > 0 ? durationMs : 1
  const pct = (ms: number) => Math.min(100, Math.max(0, (ms / durationSafe) * 100))

  const label = useMemo(() => {
    if (status === "loading") return "Building preview strip…"
    if (status === "error") return "Preview strip unavailable"
    if (tiles.length === 0) return "Film overview (optional)"
    return "Film scan (low density)"
  }, [status, tiles.length])

  const showStripChrome = status === "loading" || tiles.length > 0 || status === "error"

  return (
    <div className={showStripChrome ? "mt-3 space-y-2" : "mt-2"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={
            tiles.length === 0 && status !== "loading"
              ? "text-[9px] font-medium uppercase tracking-wide text-slate-600"
              : "text-[10px] font-semibold uppercase tracking-wide text-slate-500"
          }
        >
          {label}
        </p>
        {status === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" aria-hidden />
        ) : null}
      </div>
      <div
        className={
          tiles.length === 0 && status !== "loading"
            ? "relative overflow-hidden rounded-md border border-white/5 bg-black/20"
            : "relative overflow-hidden rounded-lg border border-white/10 bg-black/40"
        }
      >
        <div
          className="flex h-[52px] gap-px overflow-x-auto"
          role="list"
          aria-label="Film preview thumbnails"
        >
          {tiles.length === 0 ? (
            <div
              className={
                status === "loading"
                  ? "flex min-h-[52px] min-w-full items-center justify-center px-3 py-2 text-center text-[11px] leading-snug text-slate-500"
                  : "flex min-h-[40px] min-w-full items-center justify-center px-2 py-1.5 text-center text-[10px] leading-snug text-slate-600/90"
              }
            >
              {status === "loading"
                ? "Sampling a few frames for context — playback and marking stay available."
                : status === "error"
                  ? "Thumbnails could not load; timeline scrubbing works as usual."
                  : "Sparse thumbnails may appear here when available (~1–4s apart)."}
            </div>
          ) : (
            tiles.map((t, i) => (
              <button
                key={`${t.tMs}-${i}`}
                type="button"
                role="listitem"
                className="relative h-[52px] min-w-[68px] max-w-[80px] shrink-0 overflow-hidden border-r border-white/10 bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                onClick={() => onSeekMs(t.tMs)}
                title={`Jump to ${(t.tMs / 1000).toFixed(1)}s`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.src} alt="" className="h-full w-full object-cover opacity-95" draggable={false} />
              </button>
            ))
          )}
        </div>
        {tiles.length > 0 ? (
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-[2] w-px bg-emerald-400/90 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
            style={{ left: `${pct(playheadMs)}%`, transform: "translateX(-50%)" }}
          />
        ) : null}
      </div>
    </div>
  )
}
