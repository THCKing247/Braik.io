/**
 * Client-side dashboard bootstrap timing (bootstrap-light vs deferred-core).
 * Enable: NEXT_PUBLIC_BRAIK_BOOTSTRAP_PERF=1 or window.__BRAIK_BOOTSTRAP_PERF__ = true
 */
function enabled(): boolean {
  if (typeof window === "undefined") return false
  if ((window as unknown as { __BRAIK_BOOTSTRAP_PERF__?: boolean }).__BRAIK_BOOTSTRAP_PERF__ === true) return true
  return process.env.NEXT_PUBLIC_BRAIK_BOOTSTRAP_PERF === "1"
}

export function dashboardBootstrapClientPerf(label: string, detail?: Record<string, unknown>) {
  if (!enabled()) return
  console.info(`[braik-bootstrap-client] ${label}`, {
    t: Math.round(performance.now()),
    ...detail,
  })
}
