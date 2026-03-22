import { SEASON_STAT_KEYS } from "@/lib/stats-helpers"

const ALLOWED_STAT_KEYS = new Set<string>([...SEASON_STAT_KEYS])

/** Keep only known numeric stat keys; values must be non-negative integers. */
export function sanitizeWeeklyStatsInput(raw: unknown): Record<string, number> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED_STAT_KEYS.has(k)) continue
    if (v === "" || v === undefined || v === null) continue
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) continue
    out[k] = n
  }
  return out
}
