import Link from "next/link"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { MarketingFaqAccordion } from "@/components/marketing/marketing-faq-accordion"
import { MARKETING_FAQ_ENTRIES } from "@/lib/marketing/faq-content"

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <section className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#F8FAFC] via-white to-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#3B82F6]/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#60A5FA]/10 blur-3xl" />
        </div>
        <div className="container mx-auto px-4 py-20 relative z-10">
          <h1 className="text-4xl md:text-5xl font-athletic font-bold text-center mb-4 text-[#212529] uppercase tracking-tight">
            FAQ
          </h1>
          <p className="text-center text-[#495057] max-w-2xl mx-auto mb-10">
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
          <MarketingFaqAccordion entries={MARKETING_FAQ_ENTRIES} className="max-w-3xl mx-auto" />
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
