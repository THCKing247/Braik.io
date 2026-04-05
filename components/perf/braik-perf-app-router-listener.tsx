"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
import { braikPerfClientEnabled } from "@/lib/perf/braik-perf-config"
import { perfLogClient } from "@/lib/perf/braik-perf-client"

/**
 * Measures App Router client navigations (pathname commit → pathname commit).
 * See Network tab for server work; this covers client-side transition latency.
 */
export function BraikPerfAppRouterListener() {
  const pathname = usePathname()
  const prev = useRef<string | null>(null)
  const navStart = useRef(0)

  useEffect(() => {
    if (!braikPerfClientEnabled()) return
    const path = pathname ?? ""
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
