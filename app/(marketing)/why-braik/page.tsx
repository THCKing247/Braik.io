import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { WhyBraikMarketingSections } from "@/components/why-braik/why-braik-marketing-sections"
import { MarketingPageViewTracker } from "@/components/marketing/marketing-page-view-tracker"

export default function WhyBraikPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingPageViewTracker event="viewed_why_braik" source="why_braik_page" />
      <SiteHeader />
      <WhyBraikMarketingSections />
      <SiteFooter />
    </div>
  )
}
