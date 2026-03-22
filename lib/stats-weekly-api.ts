import { SEASON_STAT_KEYS } from "@/lib/stats-helpers"
import { LEGACY_WEEKLY_STAT_KEYS } from "@/lib/stats-schema"
import type { SeasonStatKey } from "@/lib/stats-schema"

const ALLOWED_STAT_KEYS = new Set<string>([...SEASON_STAT_KEYS, ...LEGACY_WEEKLY_STAT_KEYS])

/** DB keys that may store fractional stats (e.g. shared credit). All other stats stay integers. */
export const DECIMAL_ALLOWED_STAT_KEYS = new Set<string>(["sacks", "tackles_for_loss"])

/**
 * Parse a non-empty stat string (CSV or form). Rejects scientific notation.
 * Uses `dbKey` to decide integer vs decimal allowance.
 */
export function parseNonNegativeStatNumberFromString(trimmed: string, dbKey: string): number | null {
  if (trimmed === "") return null
  if (/[eE]/.test(trimmed)) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0) return null
  if (DECIMAL_ALLOWED_STAT_KEYS.has(dbKey)) return n
  if (!Number.isInteger(n)) return null
  return n
}

/** Keep only known numeric stat keys; integers except `sacks` and `tackles_for_loss` (non-negative numbers). */
export function sanitizeWeeklyStatsInput(raw: unknown): Record<string, number> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ALLOWED_STAT_KEYS.has(k)) continue
    if (v === "" || v === undefined || v === null) continue
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0) continue
    if (DECIMAL_ALLOWED_STAT_KEYS.has(k)) {
      out[k] = n
    } else if (Number.isInteger(n)) {
      out[k] = n
    }
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
