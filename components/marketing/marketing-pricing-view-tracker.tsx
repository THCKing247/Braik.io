"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { trackMarketingEvent } from "@/lib/utils/analytics-client"

/**
 * Fires `viewed_pricing` when the section scrolls into view (same behavior as previous inline IntersectionObserver on the homepage).
 */
export function MarketingPricingViewTracker({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const target = ref.current
    if (!target) return
    let hasTracked = false
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && !hasTracked) {
          hasTracked = true
          trackMarketingEvent("viewed_pricing", { source: "landing_page_section" })
          observer.disconnect()
        }
      },
      { threshold: 0.45 }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={ref} className={className}>
      {children}
    </section>
  )
}
