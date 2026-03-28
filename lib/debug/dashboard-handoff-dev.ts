/**
 * Opt-in dashboard AD → team handoff traces. Set in dev tools:
 *   localStorage.setItem('braik_debug_dashboard_handoff', '1')
 * Clear:
 *   localStorage.removeItem('braik_debug_dashboard_handoff')
 */
const STORAGE_KEY = "braik_debug_dashboard_handoff"

export function isDashboardHandoffDebugEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false
  try {
    return typeof window !== "undefined" && window.localStorage?.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function devDashboardHandoffLog(...args: unknown[]): void {
  if (!isDashboardHandoffDebugEnabled()) return
  console.debug("[braik:dashboard-handoff]", ...args)
}
