"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
import { braikPerfClientEnabled } from "@/lib/perf/braik-perf-config"
import { consumeBraikRouteIntent, perfLogClient } from "@/lib/perf/braik-perf-client"

/**
 * Measures App Router client navigations.
 * - `route_transition`: pathname commit -> pathname commit.
 * - `route_transition.intent_to_commit`: user click intent -> pathname commit when links call markBraikRouteIntent().
 */
export function BraikPerfAppRouterListener() {
  const pathname = usePathname()
  const prev = useRef<string | null>(null)
  const navStart = useRef(0)

  useEffect(() => {
    if (!braikPerfClientEnabled()) return
    const path = pathname ?? ""
    const intentMs = consumeBraikRouteIntent(path)
    if (intentMs != null) {
      perfLogClient("route_transition.intent_to_commit", { to: path, ms: intentMs })
    }
    if (prev.current === null) {
      prev.current = path
      navStart.current = performance.now()
      return
    }
    if (prev.current !== path) {
      perfLogClient("route_transition", {
        from: prev.current,
        to: path,
        ms: Math.round(performance.now() - navStart.current),
      })
      prev.current = path
      navStart.current = performance.now()
    }
  }, [pathname])

  return null
}
