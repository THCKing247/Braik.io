"use client"

import { HeroShatterCta } from "@/components/marketing/hero-shatter-cta"
import { trackMarketingEvent } from "@/lib/utils/analytics-client"

export function MarketingFinalShatterCta() {
  return (
    <HeroShatterCta
      size="lg"
      className="text-base px-10 py-6"
      onAnimationStart={() => trackMarketingEvent("clicked_cta", { cta: "get_started_final" })}
    />
  )
}
