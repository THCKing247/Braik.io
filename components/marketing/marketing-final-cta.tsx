"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { marketingSectionShell } from "@/components/marketing/marketing-layout"
import { trackMarketingEvent } from "@/lib/utils/analytics-client"

type MarketingFinalCtaProps = {
  title: string
  description: string
  primaryHref: string
  primaryLabel: string
  secondaryHref?: string
  secondaryLabel?: string
  primaryAnalyticsCta: string
  secondaryAnalyticsCta?: string
}

export function MarketingFinalCta({
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref = "/#request-demo",
  secondaryLabel = "Book a Demo",
  primaryAnalyticsCta,
  secondaryAnalyticsCta = "marketing_final_book_demo",
}: MarketingFinalCtaProps) {
  return (
    <section className="relative py-16 md:py-24 bg-[#0F172A] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden>
        <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-[#3B82F6]/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[#60A5FA]/15 blur-3xl" />
      </div>
      <div className={`${marketingSectionShell} max-w-3xl text-center relative z-10`}>
        <h2 className="text-3xl md:text-4xl font-athletic font-bold text-slate-100 uppercase tracking-tight mb-4">{title}</h2>
        <p className="text-lg leading-relaxed text-slate-100 mb-10">{description}</p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4">
          <Button
            asChild
            size="lg"
            className="bg-[#3B82F6] hover:bg-[#2563EB] text-slate-50 font-athletic uppercase tracking-wide min-h-[52px] px-8 shadow-lg shadow-[#3B82F6]/25"
          >
            <Link
              href={primaryHref}
              onClick={() => trackMarketingEvent("clicked_cta", { cta: primaryAnalyticsCta })}
            >
              {primaryLabel}
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-2 border-white/30 bg-white/5 text-slate-100 hover:bg-white/10 hover:border-white/50 font-athletic uppercase tracking-wide min-h-[52px] px-8"
          >
            <Link
              href={secondaryHref}
              onClick={() => trackMarketingEvent("clicked_cta", { cta: secondaryAnalyticsCta })}
            >
              {secondaryLabel}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
