/**
 * Shared formatting for roster print, PDF, and HTML exports.
 */

/** Title-case words (simple; suitable for school names). */
export function formatSchoolDisplayName(raw: string | null | undefined): string {
  if (raw == null || !String(raw).trim()) return ""
  return String(raw)
    .trim()
    .split(/\s+/)
    .map((w) => {
      const lower = w.toLowerCase()
      if (lower.length === 0) return w
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(" ")
}

/** Football-style position group: compact uppercase (QB, WR, OL, …). */
export function formatPositionDisplay(raw: string | null | undefined): string {
  if (raw == null || !String(raw).trim()) return ""
  return String(raw).trim().toUpperCase()
}

/** Safe cell text — never "undefined". */
export function rosterCellText(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return ""
  return String(raw)
}
