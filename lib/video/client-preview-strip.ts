/**
 * Session-only preview tiles: canvas snapshots from the loaded <video> element.
 * No server storage; bounded tile count keeps memory modest.
 */

import { suggestPreviewIntervalSec } from "@/lib/video/film-preview-manifest"

export type ClientPreviewTile = { tMs: number; src: string }

function waitSeeked(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked)
      resolve()
    }
    video.addEventListener("seeked", onSeeked)
    setTimeout(() => {
      video.removeEventListener("seeked", onSeeked)
      resolve()
    }, 2500)
  })
}

/**
 * Capture up to `maxTiles` JPEG data URLs at computed intervals while the video is seeked.
 * Restores `video.currentTime` after completion. Pauses playback during capture.
 */
export async function captureClientPreviewStrip(
  video: HTMLVideoElement,
  durationMs: number,
  opts?: { maxTiles?: number },
): Promise<ClientPreviewTile[]> {
  const maxTiles = Math.min(96, Math.max(8, opts?.maxTiles ?? 64))
  if (!Number.isFinite(durationMs) || durationMs < 500) return []

  const intervalMs = Math.round(suggestPreviewIntervalSec(durationMs, maxTiles) * 1000)
  const times: number[] = []
  for (let t = 0; t <= durationMs && times.length < maxTiles; t += intervalMs) {
    times.push(Math.min(Math.round(t), Math.max(0, durationMs - 1)))
  }
  if (times.length === 0 || times[times.length - 1]! < durationMs - 200) {
    times.push(Math.max(0, durationMs - 1))
  }

  const wasPaused = video.paused
  video.pause()

  const prevTime = video.currentTime
  const out: ClientPreviewTile[] = []

  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) {
    video.currentTime = prevTime
    if (!wasPaused) void video.play().catch(() => {})
    return []
  }

  const canvas = document.createElement("canvas")
  const targetW = 96
  const targetH = Math.max(1, Math.round((h / w) * targetW))
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    video.currentTime = prevTime
    if (!wasPaused) void video.play().catch(() => {})
    return []
  }

  try {
    for (const tMs of times) {
      video.currentTime = tMs / 1000
      await waitSeeked(video)
      ctx.drawImage(video, 0, 0, targetW, targetH)
      const src = canvas.toDataURL("image/jpeg", 0.56)
      out.push({ tMs, src })
    }
  } finally {
    video.currentTime = prevTime
    await waitSeeked(video)
    if (!wasPaused) void video.play().catch(() => {})
  }

  return out
}
