"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { saveLastVisitedAppPath } from "@/lib/navigation/last-visited-route"

/** Persists recent `/dashboard` or `/admin` paths for mobile `/` → app resume. */
export function LastVisitedRouteTracker() {
  const pathname = usePathname()
  useEffect(() => {
    if (pathname) saveLastVisitedAppPath(pathname)
  }, [pathname])
  return null
}
