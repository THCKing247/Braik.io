import { ScrollReveal } from "@/components/marketing/scroll-reveal"
import { SectionSplit } from "@/components/marketing/section-split"
import { landingContainerSplit, landingLightSection } from "@/lib/marketing/landing-visual-theme"
import { HomeBrandPanel } from "./home-brand-panel"
import { lightSectionBody, lightSectionColumn, lightSectionH2 } from "./home-theme"

export function HomeVarsityJvSection() {
  return (
    <section className={landingLightSection}>
      <div className={landingContainerSplit}>
        <ScrollReveal>
          <SectionSplit>
            <div className={`min-w-0 space-y-8 ${lightSectionColumn}`}>
              <h2 className={lightSectionH2}>Built for entire programs — Varsity and JV</h2>
              <div className="space-y-6 pt-2">
                <p className={lightSectionBody}>
                  Most athletic programs don&apos;t operate as a single roster. Varsity and JV teams often share
                  resources, staff, and schedules—but are forced into separate systems or duplicate subscriptions.
                </p>
                <p className={lightSectionBody}>
                  Braik was built to reflect how programs actually function. Varsity and JV teams are managed under one
                  program, giving coaches a unified system without sacrificing team-level autonomy.
                </p>
                <p className={lightSectionBody}>
                  Varsity Head Coaches manage the full program and can create and configure JV teams, assign JV Head
                  Coaches, and maintain program-level oversight. JV Head Coaches have full authority over their own team
                  dashboards, schedules, communication, and players, but cannot access or override Varsity teams or
                  program-level settings.
                </p>
                <p className={lightSectionBody}>
                  This structure keeps programs unified while respecting clear lines of responsibility and authority.
                </p>
              </div>
            </div>
            <div className="min-w-0">
              <HomeBrandPanel variant="program-tiers" />
            </div>
          </SectionSplit>
        </ScrollReveal>
      </div>
    </section>
  )
}
