"use client"

import { useEffect } from "react"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { WhyBraikMarketingSections } from "@/components/why-braik/why-braik-marketing-sections"
import { trackMarketingEvent } from "@/lib/utils/analytics-client"

export default function WhyBraikPage() {
  useEffect(() => {
    trackMarketingEvent("viewed_why_braik", { source: "why_braik_page" })
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <WhyBraikMarketingSections />
      <SiteFooter />
    </div>
  )
}
