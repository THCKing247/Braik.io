import { braikClientPerfBundleEnabled } from "@/lib/debug/braik-client-perf-master"

/**
 * Opt-in dashboard shell timing (browser console).
 * Enable with NEXT_PUBLIC_BRAIK_PERF=1, NEXT_PUBLIC_BRAIK_DASH_SHELL_PERF=1, or window.__BRAIK_DASH_SHELL_PERF__ = true
 */
function dashboardShellPerfEnabled(): boolean {
  if (typeof window === "undefined") return false
  if (braikClientPerfBundleEnabled()) return true
  if ((window as unknown as { __BRAIK_DASH_SHELL_PERF__?: boolean }).__BRAIK_DASH_SHELL_PERF__ === true) return true
  return process.env.NEXT_PUBLIC_BRAIK_DASH_SHELL_PERF === "1"
}

/** Passive markers for shell / sidebar / home readiness (Phase 3). */
export function dashboardShellPerf(label: string, detail?: Record<string, unknown>): void {
  if (typeof window === "undefined" || !dashboardShellPerfEnabled()) return
  console.info(`[braik-dashboard-perf] ${label}`, {
    t: Math.round(performance.now()),
    ...detail,
  })
}
