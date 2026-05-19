"use client"

import { useEffect } from "react"
import { installClientApiFetchMonitor, logClientApiFetchSummary } from "@/lib/debug/client-api-fetch-monitor"

/**
 * Dev diagnostics: duplicate /api URL warnings + Supabase messaging RPC warnings in the console.
 * Enable in production with `NEXT_PUBLIC_DEBUG_FETCHES=1`.
 */
export function ClientApiFetchMonitor() {
  useEffect(() => {
    installClientApiFetchMonitor()
    if (process.env.NODE_ENV === "development") {
      const t = window.setTimeout(() => logClientApiFetchSummary(), 8_000)
      return () => window.clearTimeout(t)
    }
  }, [])
  return null
}
