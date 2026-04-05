"use client"

/**
 * Client-side perf: console + Performance marks (DevTools → Performance).
 */
import { braikPerfClientEnabled } from "@/lib/perf/braik-perf-config"
import { useEffect, useRef } from "react"

const PREFIX = "braik"

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

/**
 * Log once when `when` becomes true (e.g. bootstrap query success).
 * Avoid passing unstable object identities — use optional `detailKey` string for disambiguation.
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

/** Report LCP once (Chromium). */
export function useBraikPerfLcp(): void {
  useEffect(() => {
    if (!braikPerfClientEnabled() || typeof PerformanceObserver === "undefined") return
    try {
      const po = new PerformanceObserver((list) => {
        const entries = list.getEntries() as Array<PerformanceEntry & { startTime?: number }>
        const last = entries[entries.length - 1]
        if (last && typeof last.startTime === "number") {
          perfLogClient("web_vitals.lcp", { ms: Math.round(last.startTime) })
        }
      })
      po.observe({ type: "largest-contentful-paint", buffered: true } as PerformanceObserverInit)
      return () => po.disconnect()
    } catch {
      return
    }
  }, [])
}
