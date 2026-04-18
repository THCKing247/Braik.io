/**
 * Session-only preview tiles: canvas snapshots from the loaded <video> element.
 * No server storage; bounded tile count keeps memory modest.
 */

import { suggestPreviewIntervalSec } from "@/lib/video/film-preview-manifest"

export type ClientPreviewTile = { tMs: number; src: string }

/**
 * Canvas capture needs a CORS-enabled video response (e.g. R2 bucket CORS allowing this origin)
 * plus crossOrigin="anonymous" on the element. Waits until dimensions are known.
 */
async function waitForVideoSurface(video: HTMLVideoElement, timeoutMs = 5000): Promise<boolean> {
  if (video.videoWidth > 0 && video.videoHeight > 0) return true
  return new Promise((resolve) => {
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      clearTimeout(tid)
      video.removeEventListener("loadeddata", onTry)
      video.removeEventListener("loadedmetadata", onTry)
      video.removeEventListener("canplay", onTry)
      resolve(ok)
    }
    const onTry = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) finish(true)
    }
    const tid = window.setTimeout(() => finish(video.videoWidth > 0 && video.videoHeight > 0), timeoutMs)
    video.addEventListener("loadeddata", onTry)
    video.addEventListener("loadedmetadata", onTry)
    video.addEventListener("canplay", onTry)
  })
}

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

  await waitForVideoSurface(video)

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
      let src: string
      try {
        src = canvas.toDataURL("image/jpeg", 0.56)
      } catch {
        // Tainted canvas (missing CORS / crossOrigin) — abort; caller shows graceful empty state
        throw new Error("FILM_PREVIEW_CANVAS_TAINTED")
      }
      out.push({ tMs, src })
    }
  } finally {
    video.currentTime = prevTime
    await waitSeeked(video)
    if (!wasPaused) void video.play().catch(() => {})
  }

  return out
}
