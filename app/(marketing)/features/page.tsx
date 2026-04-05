import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { FeaturesMarketingSections } from "@/components/features/features-marketing-sections"
import { MarketingPageViewTracker } from "@/components/marketing/marketing-page-view-tracker"

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingPageViewTracker event="viewed_features" source="features_page" />
      <SiteHeader />
      <FeaturesMarketingSections />
      <SiteFooter />
    </div>
  )
}
