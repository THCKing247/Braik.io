import { ScrollReveal } from "@/components/marketing/scroll-reveal"
import { MarketingCard } from "@/components/marketing/marketing-layout"
import { landingContainer, landingH2Dark } from "@/lib/marketing/landing-visual-theme"
import { landingDarkSectionHome } from "./home-theme"

const capabilityCards = [
  {
    title: "Communication",
    body: "Targeted messaging and announcements that keep everyone informed without overwhelming anyone. The right people see the right information, automatically.",
  },
  {
    title: "Scheduling",
    body: "Calendar management with RSVPs and event coordination. Everyone sees what they need to see, when they need to see it.",
  },
  {
    title: "Payments",
    body: "Season-based dues collection and coach-collected payments with clear tracking and accountability. Know who's paid, who hasn't, and what's outstanding.",
  },
  {
    title: "Documents",
    body: "Centralized playbooks, installs, and program resources. Organized by unit and position, with acknowledgement tracking for important materials.",
  },
  {
    title: "Inventory",
    body: "Equipment tracking and assignment for team-issued gear. Know what you have, where it is, and who's responsible for it.",
  },
  {
    title: "Roster Management",
    body: "Player tracking, position management, and depth charts. Everything organized the way your program actually operates.",
  },
] as const

export function HomeCapabilitiesSection() {
  return (
    <section className={landingDarkSectionHome}>
      <div className={landingContainer}>
        <div className="mx-auto max-w-5xl">
          <ScrollReveal>
            <h2 className={`${landingH2Dark} mb-12 text-center md:mb-16`}>Core operational areas</h2>
          </ScrollReveal>

          <div className="grid gap-6 md:grid-cols-2">
            {capabilityCards.map((card, index) => (
              <ScrollReveal key={card.title} delay={index * 50} className="h-full">
                <MarketingCard title={card.title} variant="dark" className="h-full">
                  <p>{card.body}</p>
                </MarketingCard>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
