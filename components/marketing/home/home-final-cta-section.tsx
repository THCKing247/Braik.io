import { ScrollReveal } from "@/components/marketing/scroll-reveal"
import { landingBodyDark, landingContainer, landingFinalCtaSection, landingH2Dark } from "@/lib/marketing/landing-visual-theme"
import { HomeFinalCtaTracked } from "./home-final-cta-tracked"

export function HomeFinalCtaSection() {
  return (
    <section className={landingFinalCtaSection}>
      <div className={landingContainer}>
        <div className="mx-auto max-w-3xl text-center">
          <ScrollReveal>
            <div className="space-y-10">
              <h2 className={`${landingH2Dark} text-balance`}>See if Braik fits your program</h2>
              <div className={`space-y-6 pt-2 ${landingBodyDark}`}>
                <p>
                  Braik was built to support coaches who are stretched thin, giving them the tools—and the help—they need
                  to run their programs without sacrificing focus, organization, or time with their team.
                </p>
                <p>
                  If you&apos;re running a program where organization, communication, and accountability matter—but time and
                  staffing are limited—Braik is built for you.
                </p>
              </div>
              <div className="pt-6">
                <HomeFinalCtaTracked />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
