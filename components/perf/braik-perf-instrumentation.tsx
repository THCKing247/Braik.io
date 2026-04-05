"use client"

import { BraikPerfAppRouterListener } from "@/components/perf/braik-perf-app-router-listener"
import { braikPerfClientEnabled } from "@/lib/perf/braik-perf-config"
import { useBraikPerfLcp } from "@/lib/perf/braik-perf-client"

/**
 * Gated client instrumentation: route intervals + LCP. Add inside root providers when perf is on.
 */
export function BraikPerfInstrumentation() {
  useBraikPerfLcp()
  if (!braikPerfClientEnabled()) return null
  return <BraikPerfAppRouterListener />
}
