import { braikPerfServerEnabled } from "@/lib/perf/braik-perf-config"

/**
 * Opt-in route timing for API debugging.
 * `BRAIK_PERF=1` | `BRAIK_PERF_DEBUG=1` | development.
 */
export function shouldLogRoutePerf(): boolean {
  return (
    braikPerfServerEnabled() ||
    process.env.BRAIK_PERF_DEBUG === "1"
  )
}

export type RoutePerfSink = Array<{ label: string; ms: number }>

export async function routePerf<T>(sink: RoutePerfSink | null, label: string, fn: () => Promise<T>): Promise<T> {
  if (!sink) return fn()
  const t0 = performance.now()
  try {
    return await fn()
  } finally {
    sink.push({ label, ms: Math.round(performance.now() - t0) })
  }
}

export function logRoutePerf(routeLabel: string, sink: RoutePerfSink, meta?: Record<string, string>): void {
  if (!shouldLogRoutePerf() || sink.length === 0) return
  const parts = sink.map((s) => `${s.label}=${s.ms}ms`).join(" ")
  const extra = meta ? ` ${Object.entries(meta).map(([k, v]) => `${k}=${v}`).join(" ")}` : ""
  console.info(`[braik-perf] ${routeLabel}${extra} ${parts}`)
}
