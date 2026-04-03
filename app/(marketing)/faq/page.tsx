import Link from "next/link"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { MarketingFaqAccordion } from "@/components/marketing/marketing-faq-accordion"
import { MARKETING_FAQ_ENTRIES } from "@/lib/marketing/faq-content"
import {
  MarketingHeroShell,
  MarketingPageSection,
  MarketingShell,
  marketingBodyClass,
  marketingSectionShell,
} from "@/components/marketing/marketing-page"

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <MarketingHeroShell>
        <div className={`${marketingSectionShell} text-center max-w-3xl mx-auto`}>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-6">
            FAQ
          </h1>
          <p className={`${marketingBodyClass} text-[#212529]/85`}>
            Answers here stay short; we link out to{" "}
            <Link href="/pricing" className="text-[#2563EB] font-medium hover:underline">
              pricing
            </Link>
            ,{" "}
            <Link href="/ai-transparency" className="text-[#2563EB] font-medium hover:underline">
              AI transparency
            </Link>
            , and policies when the full detail already lives there.
          </p>
        </div>
      </MarketingHeroShell>

      <MarketingPageSection variant="gradient">
        <MarketingShell>
          <MarketingFaqAccordion entries={MARKETING_FAQ_ENTRIES} className="max-w-3xl mx-auto" />
        </MarketingShell>
      </MarketingPageSection>

      <SiteFooter />
    </div>
  )
}
