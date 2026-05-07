"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { trackMarketingEvent } from "@/lib/utils/analytics-client"

export function PricingSectionViewTracker({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const target = ref.current
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
