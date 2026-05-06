"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { HeroShatterCta } from "@/components/marketing/hero-shatter-cta"
import { trackMarketingEvent } from "@/lib/utils/analytics-client"

export function MarketingHeroCtaRow() {
  return (
    <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
      <HeroShatterCta
        size="lg"
        className="text-base px-10 py-6 w-full sm:w-auto"
        onAnimationStart={() => trackMarketingEvent("clicked_cta", { cta: "get_started_hero" })}
      />
      <Link href="/pricing" onClick={() => trackMarketingEvent("clicked_cta", { cta: "view_pricing_hero" })}>
        <Button
          size="lg"
          variant="outline"
          className="text-base px-10 py-6 w-full sm:w-auto border-slate-300 text-slate-800 hover:bg-slate-50"
        >
          View pricing
        </Button>
      </Link>
      <Link href="/#request-demo" onClick={() => trackMarketingEvent("clicked_cta", { cta: "request_demo_hero" })}>
        <Button
          size="lg"
          variant="ghost"
          className="text-base px-10 py-6 w-full sm:w-auto text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        >
          Request demo
        </Button>
      </Link>
    </div>
  )
}
