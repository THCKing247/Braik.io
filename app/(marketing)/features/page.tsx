"use client"

import { useEffect } from "react"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { FeaturesMarketingSections } from "@/components/features/features-marketing-sections"
import { trackMarketingEvent } from "@/lib/utils/analytics-client"

export default function FeaturesPage() {
  useEffect(() => {
    trackMarketingEvent("viewed_features", { source: "features_page" })
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <FeaturesMarketingSections />
      <SiteFooter />
    </div>
  )
}
