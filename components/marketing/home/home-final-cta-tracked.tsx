"use client"

import { HeroShatterCta } from "@/components/marketing/hero-shatter-cta"
import { trackMarketingEvent } from "@/lib/utils/analytics-client"
import { heroPrimaryCta } from "./home-theme"

export function HomeFinalCtaTracked() {
  return (
    <HeroShatterCta
      size="lg"
      className={heroPrimaryCta}
      onAnimationStart={() => trackMarketingEvent("clicked_cta", { cta: "get_started_final" })}
    />
  )
}
