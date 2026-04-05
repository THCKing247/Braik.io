import Link from "next/link"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { MarketingFaqAccordion } from "@/components/marketing/marketing-faq-accordion"
import { MARKETING_FAQ_ENTRIES } from "@/lib/marketing/faq-content"
import {
  MarketingHeroShell,
  MarketingPageSection,
  MarketingShell,
  marketingSectionShell,
} from "@/components/marketing/marketing-page"

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <MarketingHeroShell>
        <div className={`${marketingSectionShell} mx-auto max-w-3xl text-center`}>
          <h1 className="mb-6 font-athletic text-4xl font-bold uppercase tracking-tight text-gray-900 md:text-5xl lg:text-6xl">
            FAQ
          </h1>
          <p className="text-base leading-relaxed text-gray-800 md:text-lg">
            Answers here stay short; we link out to{" "}
            <Link href="/pricing" className="font-medium text-blue-700 underline decoration-blue-700/35 underline-offset-4 hover:text-blue-800">
              pricing
            </Link>
            ,{" "}
            <Link href="/ai-transparency" className="font-medium text-blue-700 underline decoration-blue-700/35 underline-offset-4 hover:text-blue-800">
              AI transparency
            </Link>
            , and policies when the full detail already lives there.
          </p>
        </div>
      </MarketingHeroShell>

      <MarketingPageSection variant="gradient">
        <MarketingShell>
          <MarketingFaqAccordion entries={MARKETING_FAQ_ENTRIES} className="mx-auto max-w-3xl" />
        </MarketingShell>
      </MarketingPageSection>

      <SiteFooter />
    </div>
  )
}
