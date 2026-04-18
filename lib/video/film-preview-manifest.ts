/**
 * Lightweight film preview strip — sparse thumbnails only (never full-frame archives).
 */

export type FilmPreviewManifestV1 = {
  version: 1
  intervalSec: number
  status: "pending" | "ready" | "failed" | "skipped"
  /** R2 keys relative to bucket (full key path). */
  tiles: Array<{ tMs: number; key: string }>
  generatedAt?: string
  source?: "ffmpeg" | "client_upload"
}

export function parseFilmPreviewManifest(raw: unknown): FilmPreviewManifestV1 | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  if (o.version !== 1) return null
  const intervalSec = typeof o.intervalSec === "number" ? o.intervalSec : Number(o.intervalSec)
  if (!Number.isFinite(intervalSec) || intervalSec <= 0) return null
  const status = o.status
  if (status !== "pending" && status !== "ready" && status !== "failed" && status !== "skipped") return null
  const tilesRaw = o.tiles
  if (!Array.isArray(tilesRaw)) return null
  const tiles: FilmPreviewManifestV1["tiles"] = []
  for (const t of tilesRaw) {
    if (!t || typeof t !== "object") continue
    const tr = t as Record<string, unknown>
    const tMs = typeof tr.tMs === "number" ? tr.tMs : Number(tr.tMs)
    const key = typeof tr.key === "string" ? tr.key : ""
    if (!Number.isFinite(tMs) || !key) continue
    tiles.push({ tMs: Math.round(tMs), key })
  }
  return {
    version: 1,
    intervalSec,
    status,
    tiles,
    generatedAt: typeof o.generatedAt === "string" ? o.generatedAt : undefined,
    source: o.source === "ffmpeg" || o.source === "client_upload" ? o.source : undefined,
  }
}

/** Compute ~uniform sampling interval so tile count stays bounded (storage + UI). */
export function suggestPreviewIntervalSec(durationMs: number, maxTiles: number): number {
  const dSec = Math.max(0.001, durationMs / 1000)
  const target = Math.min(maxTiles, 80)
  const raw = dSec / target
  return Math.min(4, Math.max(1.25, Math.round(raw * 4) / 4))
}
