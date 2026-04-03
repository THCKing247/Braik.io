"use client"

import { useEffect } from "react"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { PricingMarketingSections } from "@/components/pricing/pricing-marketing-sections"
import { trackMarketingEvent } from "@/lib/utils/analytics-client"

export default function PricingPage() {
  useEffect(() => {
    trackMarketingEvent("viewed_pricing", { source: "pricing_page" })
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <PricingMarketingSections />
      <SiteFooter />
    </div>
  )
}
