import dynamic from "next/dynamic"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { MobileRootRedirect } from "@/components/marketing/mobile-root-redirect"
import { HomeHeroSection } from "@/components/marketing/home/home-hero-section"
import { HomeCoachRealitySection } from "@/components/marketing/home/home-coach-reality-section"
import { HomeOneSystemSection } from "@/components/marketing/home/home-one-system-section"
import { HomeBuiltConstraintsSection } from "@/components/marketing/home/home-built-constraints-section"
import { HomeVarsityJvSection } from "@/components/marketing/home/home-varsity-jv-section"
import { HomeCapabilitiesSection } from "@/components/marketing/home/home-capabilities-section"
import { HomeRolesSection } from "@/components/marketing/home/home-roles-section"
import { HomeAiSection } from "@/components/marketing/home/home-ai-section"
import { HomeFinalCtaSection } from "@/components/marketing/home/home-final-cta-section"
import { HomeRequestDemoSection } from "@/components/marketing/home/home-request-demo-section"

/**
 * Below-the-fold / non-LCP: separate chunks to shrink the main home bundle.
 * Hero field image keeps `priority`; one-system panel uses default lazy load — do not add `priority`
 * to below-fold images (see PERFORMANCE_GUIDELINES.md).
 */
const LeadCaptureFormLazy = dynamic(
  () => import("@/components/marketing/lead-capture-form").then((m) => m.LeadCaptureForm),
  {
    loading: () => (
      <div className="min-h-[220px] w-full animate-pulse rounded-xl bg-slate-100/80" aria-hidden />
    ),
  }
)

const FAQLinkCTALazy = dynamic(
  () => import("@/components/marketing/faq-link-cta").then((m) => m.FAQLinkCTA),
  {
    loading: () => (
      <div className="min-h-[200px] w-full animate-pulse rounded-xl bg-slate-50" aria-hidden />
    ),
  }
)

export default function Home() {
  return (
    <>
      <div className="lg:hidden">
        <MobileRootRedirect />
      </div>

      <div className="hidden min-h-screen bg-white lg:block">
        <SiteHeader />
        <HomeHeroSection />
        <HomeCoachRealitySection />
        <HomeOneSystemSection />
        <HomeBuiltConstraintsSection />
        <HomeVarsityJvSection />
        <HomeCapabilitiesSection />
        <HomeRolesSection />
        <HomeAiSection />
        <FAQLinkCTALazy id="faq" imagePosition="right" />
        <HomeFinalCtaSection />
        <HomeRequestDemoSection leadForm={<LeadCaptureFormLazy />} />
        <SiteFooter />
      </div>
    </>
  )
}
