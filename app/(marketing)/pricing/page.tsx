import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { PricingMarketingSections } from "@/components/pricing/pricing-marketing-sections"
import { MarketingPageViewTracker } from "@/components/marketing/marketing-page-view-tracker"

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingPageViewTracker event="viewed_pricing" source="pricing_page" />
      <SiteHeader />
      <PricingMarketingSections />
      <SiteFooter />
    </div>
  )
}
