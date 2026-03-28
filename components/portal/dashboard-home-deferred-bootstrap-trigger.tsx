"use client"

import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  kickDeferredCoreMerge,
  DEFERRED_HOME_FALLBACK_DELAY_MS,
} from "@/lib/dashboard/dashboard-bootstrap-query"

/**
 * Loads bootstrap-deferred-core when this sentinel nears the viewport, or after a fallback delay.
 * Does not run on mount alone — avoids competing with bootstrap-light on first paint.
 */
export function DashboardHomeDeferredBootstrapTrigger({ teamId }: { teamId: string }) {
  const queryClient = useQueryClient()
  const ref = useRef<HTMLDivElement>(null)
  const fired = useRef(false)

  useEffect(() => {
    const t = teamId.trim()
    if (!t) return

    const run = () => {
      if (fired.current) return
      fired.current = true
      kickDeferredCoreMerge(t, queryClient)
    }

    const el = ref.current
    let timer: ReturnType<typeof setTimeout> | null = null

    if (typeof IntersectionObserver === "undefined" || !el) {
      timer = setTimeout(run, DEFERRED_HOME_FALLBACK_DELAY_MS)
      return () => {
        if (timer != null) clearTimeout(timer)
      }
    }

    timer = setTimeout(run, DEFERRED_HOME_FALLBACK_DELAY_MS)

    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          if (timer != null) {
            clearTimeout(timer)
            timer = null
          }
          run()
        }
      },
      { root: null, rootMargin: "200px 0px 160px 0px", threshold: 0 }
    )
    obs.observe(el)
    return () => {
      if (timer != null) clearTimeout(timer)
      obs.disconnect()
    }
  }, [teamId, queryClient])

  return <div ref={ref} className="pointer-events-none h-px w-full max-w-full shrink-0" aria-hidden />
}
