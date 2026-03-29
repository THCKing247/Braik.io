/**
 * Dev-only navigation / shell timing (browser console).
 * Enable with NEXT_PUBLIC_BRAIK_NAV_PERF=1 or window.__BRAIK_NAV_PERF__ = true
 */
function navPerfEnabled(): boolean {
  if (typeof window === "undefined") return false
  if ((window as unknown as { __BRAIK_NAV_PERF__?: boolean }).__BRAIK_NAV_PERF__ === true) return true
  return process.env.NEXT_PUBLIC_BRAIK_NAV_PERF === "1"
}

export function navPerfDev(label: string, detail?: Record<string, unknown>) {
  if (typeof window === "undefined" || !navPerfEnabled()) return
  console.info(`[braik-nav-perf] ${label}`, {
    t: Math.round(performance.now()),
    ...detail,
  })
}
