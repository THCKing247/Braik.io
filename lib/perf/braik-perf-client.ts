"use client"

/**
 * Client-side perf: console + Performance marks (DevTools -> Performance).
 */
import { braikPerfClientEnabled } from "@/lib/perf/braik-perf-config"
import { useEffect, useRef } from "react"

const PREFIX = "braik"
const navStartKey = `${PREFIX}:nav-start`

type LayoutShiftEntry = PerformanceEntry & {
  value?: number
  hadRecentInput?: boolean
}

type FirstInputEntry = PerformanceEntry & {
  processingStart?: number
}

export function perfLogClient(event: string, data: Record<string, unknown> = {}): void {
  if (!braikPerfClientEnabled() || typeof window === "undefined") return
  console.info("[braik-perf]", JSON.stringify({ event, ...data, t: Math.round(performance.now()) }))
}

function safeMark(name: string) {
  try {
    performance.mark(`${PREFIX}:${name}`)
  } catch {
    /* duplicate mark */
  }
}

export function markBraikPerf(name: string): void {
  if (!braikPerfClientEnabled() || typeof window === "undefined") return
  safeMark(name)
}

export function measureBraikPerf(event: string, startMark: string, endMark: string, extra: Record<string, unknown> = {}): void {
  if (!braikPerfClientEnabled() || typeof window === "undefined") return
  try {
    const measureName = `${PREFIX}:${event}`
    performance.measure(measureName, `${PREFIX}:${startMark}`, `${PREFIX}:${endMark}`)
    const entries = performance.getEntriesByName(measureName)
    const latest = entries[entries.length - 1]
    perfLogClient(event, { ...extra, ms: latest ? Math.round(latest.duration) : undefined })
  } catch {
    perfLogClient(event, { ...extra, measure_error: true })
  }
}

export function startBraikPerfTimer(name: string): number {
  if (!braikPerfClientEnabled() || typeof window === "undefined") return 0
  const t = performance.now()
  safeMark(`${name}.start`)
  return t
}

export function endBraikPerfTimer(event: string, start: number, extra: Record<string, unknown> = {}): void {
  if (!braikPerfClientEnabled() || typeof window === "undefined" || !start) return
  perfLogClient(event, { ...extra, ms: Math.round(performance.now() - start) })
}

/**
 * Log once when `when` becomes true (e.g. bootstrap query success).
 * Avoid passing unstable object identities -- use optional `detailKey` string for disambiguation.
 */
export function useBraikPerfOnce(event: string, when: boolean, extra: Record<string, unknown> = {}): void {
  const fired = useRef(false)
  const extraRef = useRef(extra)
  extraRef.current = extra
  useEffect(() => {
    if (!braikPerfClientEnabled() || !when || fired.current) return
    fired.current = true
    perfLogClient(event, {
      ...extraRef.current,
      ms_since_origin: Math.round(performance.now()),
    })
    safeMark(event)
  }, [event, when])
}

/** Optional: log component mount duration when effect runs late (hydration-heavy children). */
export function useBraikPerfMount(componentName: string, thresholdMs = 32): void {
  const start = useRef(typeof performance !== "undefined" ? performance.now() : 0)
  useEffect(() => {
    if (!braikPerfClientEnabled()) return
    const ms = Math.round(performance.now() - start.current)
    if (ms >= thresholdMs) {
      perfLogClient("slow_mount", { component: componentName, ms })
    }
  }, [componentName, thresholdMs])
}

/** First time dashboard bootstrap payload includes `dashboard` for this team (meaningful home content). */
export function useBraikPerfDashboardBootstrapReady(teamId: string, hasDashboardSlice: boolean): void {
  const logged = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!braikPerfClientEnabled() || !teamId.trim() || !hasDashboardSlice) return
    if (logged.current.has(teamId)) return
    logged.current.add(teamId)
    perfLogClient("dashboard.bootstrap_content_ready", {
      teamId,
      ms_since_origin: Math.round(performance.now()),
    })
    safeMark("dashboard_ready")
  }, [teamId, hasDashboardSlice])
}

/**
 * Capture browser-facing baseline metrics without adding the web-vitals package yet.
 * These logs are intentionally gated behind NEXT_PUBLIC_BRAIK_PERF/development.
 */
export function useBraikWebVitals(): void {
  useEffect(() => {
    if (!braikPerfClientEnabled() || typeof PerformanceObserver === "undefined") return
    const observers: PerformanceObserver[] = []

    const observe = (type: string, cb: PerformanceObserverCallback) => {
      try {
        const po = new PerformanceObserver(cb)
        po.observe({ type, buffered: true } as PerformanceObserverInit)
        observers.push(po)
      } catch {
        /* unsupported metric */
      }
    }

    observe("largest-contentful-paint", (list) => {
      const entries = list.getEntries() as Array<PerformanceEntry & { startTime?: number }>
      const last = entries[entries.length - 1]
      if (last && typeof last.startTime === "number") {
        perfLogClient("web_vitals.lcp", { ms: Math.round(last.startTime) })
      }
    })

    observe("layout-shift", (list) => {
      let cls = 0
      for (const entry of list.getEntries() as LayoutShiftEntry[]) {
        if (!entry.hadRecentInput) cls += entry.value ?? 0
      }
      if (cls > 0) perfLogClient("web_vitals.cls_delta", { value: Number(cls.toFixed(4)) })
    })

    observe("first-input", (list) => {
      const first = list.getEntries()[0] as FirstInputEntry | undefined
      if (first && typeof first.processingStart === "number") {
        perfLogClient("web_vitals.fid", { ms: Math.round(first.processingStart - first.startTime) })
      }
    })

    observe("event", (list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration >= 40) {
          perfLogClient("web_vitals.long_interaction", {
            name: entry.name,
            ms: Math.round(entry.duration),
          })
        }
      }
    })

    return () => observers.forEach((po) => po.disconnect())
  }, [])
}

/** Backward-compatible alias. */
export function useBraikPerfLcp(): void {
  useBraikWebVitals()
}

export function markBraikRouteIntent(to: string): void {
  if (!braikPerfClientEnabled() || typeof window === "undefined") return
  try {
    sessionStorage.setItem(navStartKey, JSON.stringify({ to, t: performance.now() }))
  } catch {
    /* storage unavailable */
  }
}

export function consumeBraikRouteIntent(pathname: string): number | null {
  if (!braikPerfClientEnabled() || typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(navStartKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { to?: string; t?: number }
    sessionStorage.removeItem(navStartKey)
    if (typeof parsed.t !== "number") return null
    return Math.round(performance.now() - parsed.t)
  } catch {
    return null
  }
}
