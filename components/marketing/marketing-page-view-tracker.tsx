"use client"

import { useEffect } from "react"
import { trackMarketingEvent } from "@/lib/utils/analytics-client"

/**
 * Tiny client island for marketing pages that are otherwise server components.
 * Keeps page-level `useEffect` analytics out of the main route module.
 */
export function MarketingPageViewTracker({
  event,
  source,
}: {
  event: string
  source: string
}) {
  useEffect(() => {
    trackMarketingEvent(event, { source })
  }, [event, source])
  return null
}
