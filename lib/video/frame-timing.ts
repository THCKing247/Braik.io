/**
 * Frame-accurate film editing helpers — internal precision in milliseconds.
 * Web video seeks to decoded frames; snapping to a nominal grid keeps marks consistent.
 */

import { clampMs } from "@/lib/video/timecode"

/** Common broadcast / camera rates coaches may choose when metadata is absent. */
export const FILM_EDITOR_FPS_PRESETS: readonly number[] = [
  23.976, 24, 25, 29.97, 30, 50, 59.94, 60,
]

export const DEFAULT_FILM_EDITOR_FPS = 30

export function frameDurationMs(fps: number): number {
  if (!Number.isFinite(fps) || fps <= 0) return 1000 / DEFAULT_FILM_EDITOR_FPS
  return 1000 / fps
}

/** Snap a time (ms) to the nearest frame boundary for the given nominal fps. */
export function snapMsToFrameGrid(ms: number, fps: number): number {
  const fd = frameDurationMs(fps)
  return Math.round(ms / fd) * fd
}

/** Move by whole frames on the grid from the current playhead (ms). */
export function stepPlayheadMsByFrames(
  playheadMs: number,
  deltaFrames: number,
  fps: number,
  durationMs: number,
): number {
  const fd = frameDurationMs(fps)
  const idx = Math.round(playheadMs / fd)
  const next = (idx + deltaFrames) * fd
  return clampMs(next, 0, durationMs)
}

/** 1-based frame index at playhead for display (coach-friendly). */
export function frameOrdinalAtPlayhead(playheadMs: number, fps: number): number {
  const fd = frameDurationMs(fps)
  return Math.round(playheadMs / fd) + 1
}

export function normalizeFpsChoice(raw: number): number {
  if (!Number.isFinite(raw) || raw < 12 || raw > 120) return DEFAULT_FILM_EDITOR_FPS
  return raw
}
