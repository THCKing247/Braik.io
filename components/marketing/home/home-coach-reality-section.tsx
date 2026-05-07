import { ScrollReveal } from "@/components/marketing/scroll-reveal"
import { landingContainer, landingLightSection } from "@/lib/marketing/landing-visual-theme"
import { lightSectionColumn } from "./home-theme"

export function HomeCoachRealitySection() {
  return (
    <section className={landingLightSection}>
      <div className={landingContainer}>
        <div className="mx-auto max-w-3xl">
          <ScrollReveal>
            <div className={`space-y-10 text-center ${lightSectionColumn}`}>
              <h2 className="normal-case font-athletic text-4xl font-bold leading-[1.05] tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
                Coaches today are expected to do far more than coach.
              </h2>
              <div className="space-y-6 pt-4 text-lg leading-relaxed md:text-xl">
                <p className="text-slate-700">
                  They manage rosters, schedules, payments, communication, documents, parents, assistants, and increasingly
                  complex software—often with limited staff and even less time.
                </p>
                <p className="text-slate-700">
                  Most programs are forced to stitch together multiple tools for scheduling, communication, payments, and
                  team coordination. The result is fragmented communication, duplicated work, confusion for parents and
                  players, and added stress for coaches.
                </p>
                <p className="text-xl font-semibold text-slate-800 md:text-2xl">Braik exists to change that.</p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
