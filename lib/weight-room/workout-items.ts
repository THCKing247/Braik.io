/**
 * Shared model for weight room session workouts (structured lift + reps rows).
 */

export type WorkoutItem = {
  lift: string
  reps: string
}

export function parseWorkoutItemsFromDb(raw: unknown): WorkoutItem[] {
  if (raw == null) return []
  if (!Array.isArray(raw)) return []
  const out: WorkoutItem[] = []
  for (const x of raw) {
    if (!x || typeof x !== "object") continue
    const o = x as Record<string, unknown>
    const lift = typeof o.lift === "string" ? o.lift.trim() : ""
    const reps = typeof o.reps === "string" ? o.reps.trim() : ""
    if (!lift && !reps) continue
    out.push({ lift, reps })
  }
  return out
}

/** Rows ready for API / DB (non-empty lift or reps). */
export function normalizeWorkoutItemsForSave(rows: WorkoutItem[]): WorkoutItem[] {
  return rows
    .map((r) => ({ lift: r.lift.trim(), reps: r.reps.trim() }))
    .filter((r) => r.lift.length > 0 || r.reps.length > 0)
}

/** One-line preview for schedule cards (not full workout). */
export function workoutItemsSummaryLine(items: WorkoutItem[], maxParts = 3): string | null {
  if (!items.length) return null
  const parts = items
    .slice(0, maxParts)
    .map((i) => {
      if (i.lift && i.reps) return `${i.lift} (${i.reps})`
      return i.lift || i.reps
    })
    .filter(Boolean)
  if (!parts.length) return null
  const suffix = items.length > maxParts ? ` +${items.length - maxParts}` : ""
  return parts.join(" · ") + suffix
}

/** Initial editor rows from session (legacy description → single row hint). */
export function initialWorkoutEditorRows(
  workoutItems: unknown,
  legacyDescription: string | null
): WorkoutItem[] {
  const parsed = parseWorkoutItemsFromDb(workoutItems)
  if (parsed.length > 0) return parsed
  const d = legacyDescription?.trim()
  if (d) return [{ lift: "", reps: d }]
  return [{ lift: "", reps: "" }]
}

/** Anchor date for TimePicker (time-only) ↔ API `start_time` string. */
export const SESSION_TIME_ANCHOR = new Date(2000, 0, 1, 0, 0, 0, 0)

export function parseSessionStartTimeToDate(startTime: string): Date {
  const s = startTime.trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  const d = new Date(SESSION_TIME_ANCHOR)
  if (!m) return d
  d.setHours(Number(m[1]), Number(m[2]), 0, 0)
  return d
}

export function sessionPickerDateToApiTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`
}

/** Session editor: visible duration presets (15 min steps, up to 2 hours). */
export const WEIGHT_SESSION_DURATION_PRESETS = [15, 30, 45, 60, 75, 90, 105, 120] as const
