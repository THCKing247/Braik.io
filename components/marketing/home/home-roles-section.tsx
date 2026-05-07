import { ScrollReveal } from "@/components/marketing/scroll-reveal"
import { MarketingCard } from "@/components/marketing/marketing-layout"
import { SectionSplit } from "@/components/marketing/section-split"
import { landingContainerSplit, landingLightSection } from "@/lib/marketing/landing-visual-theme"
import { HomeBrandPanel } from "./home-brand-panel"
import { lightSectionBody, lightSectionColumn, lightSectionH2 } from "./home-theme"

const roleCards = [
  {
    role: "Head Coach",
    details:
      "Full program oversight, roster and permissions control, collections and operational visibility for Varsity + JV.",
  },
  {
    role: "Assistant Coach",
    details: "Scoped coaching access for schedules, communication, installs, and assigned operational workflows.",
  },
  {
    role: "Player",
    details: "Clear schedule, announcements, documents, and team updates in one place with less confusion.",
  },
  {
    role: "Parent",
    details: "Reliable communication, dues tracking visibility, and the right information without inbox overload.",
  },
] as const

export function HomeRolesSection() {
  return (
    <section className={landingLightSection}>
      <div className={landingContainerSplit}>
        <ScrollReveal>
          <SectionSplit className="items-start md:items-center">
            <div className="order-2 min-w-0 md:order-1">
              <HomeBrandPanel variant="role-ecosystem" />
            </div>
            <div className={`order-1 min-w-0 space-y-6 md:order-2 ${lightSectionColumn}`}>
              <h2 className={lightSectionH2}>What you get by role</h2>
              <p className={lightSectionBody}>
                Head coaches, assistants, players, and parents each get a clear, scoped experience.
              </p>
            </div>
          </SectionSplit>
        </ScrollReveal>
        <div className="mt-14 grid gap-6 md:mt-16 md:grid-cols-2">
          {roleCards.map((item, index) => (
            <ScrollReveal key={item.role} delay={index * 50} className="h-full">
              <MarketingCard title={item.role} className="h-full">
                <p className="leading-relaxed text-slate-700">{item.details}</p>
              </MarketingCard>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
