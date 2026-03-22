import { SEASON_STAT_KEYS } from "@/lib/stats-helpers"
import { LEGACY_WEEKLY_STAT_KEYS } from "@/lib/stats-schema"
import type { SeasonStatKey } from "@/lib/stats-schema"

const ALLOWED_STAT_KEYS = new Set<string>([...SEASON_STAT_KEYS, ...LEGACY_WEEKLY_STAT_KEYS])

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

/**
 * Collapse legacy keys into canonical SYNCED keys for storage on weekly rows.
 * Omits keys with value 0 for a compact JSON object.
 */
export function normalizeWeeklyStatsForStorage(s: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}

  const get = (k: string) => s[k] ?? 0

  for (const k of SEASON_STAT_KEYS) {
    const key = k as SeasonStatKey
    let v = 0
    switch (key) {
      case "passing_touchdowns":
        v = get("passing_touchdowns") + get("passing_tds")
        break
      case "rushing_touchdowns":
        v = get("rushing_touchdowns") + get("rushing_tds")
        break
      case "receiving_touchdowns":
        v = get("receiving_touchdowns") + get("receiving_tds")
        break
      case "defensive_interceptions":
        v = get("defensive_interceptions") + get("interceptions")
        break
      case "solo_tackles": {
        let st = get("solo_tackles")
        const ast = get("assisted_tackles")
        const leg = get("tackles")
        if (st === 0 && ast === 0 && leg > 0) st = leg
        v = st
        break
      }
      case "assisted_tackles":
        v = get("assisted_tackles")
        break
      default:
        v = get(key)
    }
    if (v !== 0) out[key] = v
  }

  return out
}
