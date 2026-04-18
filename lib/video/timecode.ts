/** Film UI time helpers — internal precision in milliseconds. */

export function clampMs(ms: number, min: number, max: number): number {
  return Math.min(Math.max(ms, min), max)
}

/** Display as M:SS.hh (hundredths) under 1 hour, else H:MM:SS.hh */
export function formatMsAsTimecode(ms: number): string {
  const x = Math.max(0, Math.round(ms))
  const h = Math.floor(x / 3600000)
  const m = Math.floor((x % 3600000) / 60000)
  const s = Math.floor((x % 60000) / 1000)
  const cs = Math.floor((x % 1000) / 10)
  const pad = (n: number, w = 2) => String(n).padStart(w, "0")
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}.${pad(cs)}`
  return `${m}:${pad(s)}.${pad(cs)}`
}

/** Short label for ranges (same format, compact). */
export function formatMsRange(startMs: number, endMs: number): string {
  return `${formatMsAsTimecode(startMs)} → ${formatMsAsTimecode(endMs)}`
}

export function durationMsLabel(startMs: number, endMs: number): string {
  const d = Math.max(0, endMs - startMs)
  return formatMsAsTimecode(d)
}

/** Parse loose user input: "90", "1:30", "1:30.5", "0:01:02" → ms */
export function parseLooseTimeToMs(raw: string): number | null {
  const s = raw.trim()
  if (!s) return null
  if (/^\d+$/.test(s)) {
    const n = Number(s)
    if (!Number.isFinite(n)) return null
    return Math.round(n)
  }
  const parts = s.split(":").map((p) => p.trim())
  if (parts.some((p) => p === "" || Number.isNaN(Number(p)))) return null
  if (parts.length === 2) {
    const mi = Number(parts[0])
    const secParts = parts[1].split(".")
    const se = Number(secParts[0])
    const frac = secParts[1] != null ? Number(`0.${secParts[1]}`) : 0
    if (![mi, se].every((x) => Number.isFinite(x))) return null
    return Math.round((mi * 60 + se + frac) * 1000)
  }
  if (parts.length === 3) {
    const h = Number(parts[0])
    const mi = Number(parts[1])
    const secParts = parts[2].split(".")
    const se = Number(secParts[0])
    const frac = secParts[1] != null ? Number(`0.${secParts[1]}`) : 0
    if (![h, mi, se].every((x) => Number.isFinite(x))) return null
    return Math.round((h * 3600 + mi * 60 + se + frac) * 1000)
  }
  return null
}
