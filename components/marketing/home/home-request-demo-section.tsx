import type { ReactNode } from "react"
import { ScrollReveal } from "@/components/marketing/scroll-reveal"
import { SectionSplit } from "@/components/marketing/section-split"
import { landingContainerSplit, landingLightSection } from "@/lib/marketing/landing-visual-theme"
import { HomeBrandPanel } from "./home-brand-panel"
import { lightSectionBody, lightSectionColumn, lightSectionH2 } from "./home-theme"

export function HomeRequestDemoSection({ leadForm }: { leadForm: ReactNode }) {
  return (
    <section id="request-demo" className={landingLightSection}>
      <div className={landingContainerSplit}>
        <ScrollReveal>
          <SectionSplit className="items-start">
            <div className="order-2 min-w-0 md:order-1">
              <HomeBrandPanel variant="demo-walkthrough" />
            </div>
            <div className={`order-1 min-w-0 space-y-6 md:order-2 ${lightSectionColumn}`}>
              <h2 className={lightSectionH2}>Request a demo</h2>
              <p className={lightSectionBody}>
                Share your program details and we will follow up with a tailored Braik walkthrough.
              </p>
              {leadForm}
            </div>
          </SectionSplit>
        </ScrollReveal>
      </div>
    </section>
  )
}
