const MAX_KEYS = 40
const MAX_STRING = 400

/** Strip nested objects/arrays; cap size for safe analytics payloads. */
export function sanitizeAnalyticsMetadata(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {}
  }
  const input = raw as Record<string, unknown>
  const out: Record<string, unknown> = {}
  let n = 0
  for (const [k, v] of Object.entries(input)) {
    if (n >= MAX_KEYS) break
    if (typeof k !== "string" || k.length > 64) continue
    if (typeof v === "string") {
      out[k] = v.length > MAX_STRING ? `${v.slice(0, MAX_STRING)}…` : v
      n += 1
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = v
      n += 1
    } else if (typeof v === "boolean") {
      out[k] = v
      n += 1
    } else if (v === null) {
      out[k] = null
      n += 1
    }
  }
  return out
}
