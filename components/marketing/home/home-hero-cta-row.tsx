"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { HeroShatterCta } from "@/components/marketing/hero-shatter-cta"
import { trackMarketingEvent } from "@/lib/utils/analytics-client"
import { getParentAccessHref, getParentPrimaryCtaLabel } from "@/lib/marketing/join-cta"
import { heroDemoBtn, heroOutlineBtn, heroPrimaryCta } from "./home-theme"

export function HomeHeroCtaRow() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
      <HeroShatterCta
        size="lg"
        className={heroPrimaryCta}
        onAnimationStart={() => trackMarketingEvent("clicked_cta", { cta: "get_started_hero" })}
      />
      <Link href={getParentAccessHref()} onClick={() => trackMarketingEvent("clicked_cta", { cta: "parent_access_hero" })}>
        <Button size="lg" variant="outline" className={heroOutlineBtn}>
          {getParentPrimaryCtaLabel()}
        </Button>
      </Link>
      <Link href="/pricing" onClick={() => trackMarketingEvent("clicked_cta", { cta: "view_pricing_hero" })}>
        <Button size="lg" variant="outline" className={heroOutlineBtn}>
          View pricing
        </Button>
      </Link>
      <Link href="/#request-demo" onClick={() => trackMarketingEvent("clicked_cta", { cta: "request_demo_hero" })}>
        <Button size="lg" variant="default" className={heroDemoBtn}>
          Request demo
        </Button>
      </Link>
    </div>
  )
}
