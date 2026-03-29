/**
 * AD portal client fetch timing (teams-table, coaches bootstrap).
 * Enable: NEXT_PUBLIC_BRAIK_AD_PORTAL_PERF=1 or window.__BRAIK_AD_PORTAL_PERF__ = true
 */
function enabled(): boolean {
  if (typeof window === "undefined") return false
  if ((window as unknown as { __BRAIK_AD_PORTAL_PERF__?: boolean }).__BRAIK_AD_PORTAL_PERF__ === true) return true
  return process.env.NEXT_PUBLIC_BRAIK_AD_PORTAL_PERF === "1"
}

export function adPortalClientPerf(label: string, detail?: Record<string, unknown>) {
  if (!enabled()) return
  console.info(`[braik-ad-portal-client] ${label}`, {
    t: Math.round(performance.now()),
    ...detail,
  })
}
