import Link from "next/link"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { Button } from "@/components/ui/button"
import { LeadCaptureForm } from "@/components/marketing/lead-capture-form"
import { MarketingCard } from "@/components/marketing/marketing-layout"
import {
  MarketingHeroShell,
  MarketingPageSection,
  MarketingShell,
  marketingBodyClass,
  marketingSectionShell,
} from "@/components/marketing/marketing-page"

export const metadata = {
  title: "Request access | Braik",
  description: "Contact Braik to request access to the platform. Accounts are created by your administrator.",
}

export default function RequestAccessPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <MarketingHeroShell>
        <div className={`${marketingSectionShell} max-w-2xl mx-auto`}>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-6">
            Request access
          </h1>
          <p className={`${marketingBodyClass} text-[#212529]/85`}>
            Braik accounts are issued by your program or school administrator. If you need access, reach out to your
            coach or athletic staff, or contact us and we will route your request.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login">
              <Button
                size="lg"
                variant="outline"
                className="min-h-[52px] border-slate-300 font-athletic uppercase tracking-wide px-8"
              >
                Sign in
              </Button>
            </Link>
            <a href="mailto:support@braik.io">
              <Button size="lg" className="min-h-[52px] bg-[#3B82F6] hover:bg-[#2563EB] font-athletic uppercase tracking-wide px-8 shadow-lg shadow-[#3B82F6]/25">
                Contact us
              </Button>
            </a>
          </div>
        </div>
      </MarketingHeroShell>

      <MarketingPageSection variant="gradient">
        <MarketingShell>
          <MarketingCard title="Send us a note" className="max-w-2xl mx-auto">
            <p className="text-sm text-[#64748B] mb-6">
              Tell us who you are (school, role, sport). We will follow up with next steps.
            </p>
            <LeadCaptureForm />
          </MarketingCard>
        </MarketingShell>
      </MarketingPageSection>

      <SiteFooter />
    </div>
  )
}
