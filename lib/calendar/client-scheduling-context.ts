/**
 * Browser-only: IANA zone + local calendar date for Coach B scheduling resolution.
 * Safe to call from client components; returns null during SSR.
 */
export function getClientSchedulingContext(): { timeZone: string; localDate: string } | null {
  if (typeof window === "undefined") return null
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const d = new Date()
    const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    return { timeZone, localDate }
  } catch {
    return null
  }
}
