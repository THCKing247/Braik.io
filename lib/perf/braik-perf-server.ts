/**
 * Server-only: structured perf logs + Server-Timing. Import only from Route Handlers / server utilities.
 */
import type { NextResponse } from "next/server"
import { braikPerfAuthVerbose, braikPerfServerEnabled } from "@/lib/perf/braik-perf-config"

export function perfLogServer(event: string, data: Record<string, unknown> = {}): void {
  if (!braikPerfServerEnabled()) return
  console.info("[braik-perf]", JSON.stringify({ event, ...data, t: Date.now() }))
}

/** High-volume auth resolution (separate gate: `BRAIK_PERF_AUTH=1` or `BRAIK_PERF=1`). */
export function perfLogAuthVerbose(event: string, data: Record<string, unknown> = {}): void {
  if (!braikPerfAuthVerbose()) return
  console.info("[braik-perf]", JSON.stringify({ event, ...data, t: Date.now() }))
}

export async function perfTimeAsync<T>(event: string, fn: () => Promise<T>, extra?: Record<string, unknown>): Promise<T> {
  if (!braikPerfServerEnabled()) return fn()
  const t0 = performance.now()
  try {
    const result = await fn()
    perfLogServer(`${event}.done`, {
      ms: Math.round(performance.now() - t0),
      ...extra,
    })
    return result
  } catch (e) {
    perfLogServer(`${event}.error`, {
      ms: Math.round(performance.now() - t0),
      message: e instanceof Error ? e.message : String(e),
      ...extra,
    })
    throw e
  }
}

export type ServerTimingPart = { name: string; dur: number; desc?: string }

/** Appends RFC 6797 `Server-Timing` (visible in DevTools Network → Timing). */
export function applyServerTiming(res: NextResponse, parts: ServerTimingPart[]): NextResponse {
  if (!braikPerfServerEnabled() || parts.length === 0) return res
  const segment = parts
    .map((p) => {
      const safeName = p.name.replace(/[^a-zA-Z0-9_-]/g, "_")
      const desc = p.desc ? `;desc="${String(p.desc).replace(/"/g, "'")}"` : ""
      return `${safeName};dur=${Math.round(p.dur)}${desc}`
    })
    .join(", ")
  const prev = res.headers.get("Server-Timing")
  res.headers.set("Server-Timing", prev ? `${prev}, ${segment}` : segment)
  return res
}
