import Link from "next/link"
import { ScrollReveal } from "@/components/marketing/scroll-reveal"
import { landingBodyDark, landingContainer, landingH2Dark, landingLinkOnDark } from "@/lib/marketing/landing-visual-theme"
import { PricingSectionViewTracker } from "./pricing-section-view-tracker"
import { landingDarkSectionHome } from "./home-theme"

export function HomeBuiltConstraintsSection() {
  return (
    <PricingSectionViewTracker className={landingDarkSectionHome}>
      <div className={landingContainer}>
        <div className="mx-auto max-w-3xl">
          <ScrollReveal>
            <div className="space-y-10">
              <h2 className={`${landingH2Dark} text-center`}>Built for real program constraints</h2>
              <div className={`space-y-6 pt-4 ${landingBodyDark}`}>
                <p>
                  Braik was designed with a clear reality in mind: coaching staffs are limited, budgets are tight, and
                  expectations remain high.
                </p>
                <p>
                  Rather than pushing premium pricing or locking teams into rigid plans, Braik is structured to stay
                  accessible for real programs—especially at the high school level. The platform is built to grow with your
                  program, not force you to overpay for features you don&apos;t need.
                </p>
                <p>
                  Braik is billed per season, aligned with team dues and seasonal planning. It&apos;s budgetable,
                  intentional, and built for programs that need structure without complexity.
                </p>
                <p className="pt-2 text-center">
                  <Link href="/pricing" className={landingLinkOnDark}>
                    View full pricing →
                  </Link>
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </PricingSectionViewTracker>
  )
}
