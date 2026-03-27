/**
 * Opt-in timing for dashboard bootstrap profiling.
 * Enable with NODE_ENV=development or DEBUG_BOOTSTRAP_TIMING=1.
 */
export function shouldLogBootstrapTiming(): boolean {
  return (
    process.env.NODE_ENV === "development" || process.env.DEBUG_BOOTSTRAP_TIMING === "1"
  )
}

export type BootstrapTimingSink = { steps: Array<{ label: string; ms: number }> }

export async function timedBootstrap<T>(
  sink: BootstrapTimingSink | null,
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!sink) return fn()
  const t0 = performance.now()
  try {
    return await fn()
  } finally {
    sink.steps.push({ label, ms: Math.round(performance.now() - t0) })
  }
}

export function logBootstrapTimingSummary(
  sink: BootstrapTimingSink,
  meta: { teamId: string; userId: string; payloadCacheEnabled?: boolean }
): void {
  if (!shouldLogBootstrapTiming()) return
  const parts = sink.steps.map((s) => `${s.label}=${s.ms}ms`).join(" ")
  console.info(
    `[dashboard-bootstrap] teamId=${meta.teamId} userId=${meta.userId} payloadCacheEnabled=${Boolean(meta.payloadCacheEnabled)} ${parts}`
  )
}
