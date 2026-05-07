import Link from "next/link"
import { ScrollReveal } from "@/components/marketing/scroll-reveal"
import { MarketingCard } from "@/components/marketing/marketing-layout"
import { landingContainer, landingH2Dark, landingLinkOnDark } from "@/lib/marketing/landing-visual-theme"
import { landingDarkSectionHome } from "./home-theme"

export function HomeAiSection() {
  return (
    <section className={landingDarkSectionHome}>
      <div className={landingContainer}>
        <ScrollReveal>
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div className="space-y-8">
              <h2 className={landingH2Dark}>AI that stays inside the huddle</h2>
              <p className="text-lg leading-relaxed text-slate-50 md:text-xl">
                Coach B is Braik&apos;s AI layer for football programs: it reasons over the same roster, schedule,
                playbook, and health context your staff already maintains—so answers stay grounded in your team, not
                generic internet noise.
              </p>
              <ul className="list-none space-y-4 pl-0 text-base leading-relaxed text-slate-50 md:text-lg">
                <li className="flex gap-3">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300 shadow-[0_0_8px_rgba(147,197,253,0.6)]"
                    aria-hidden
                  />
                  <span className="text-slate-50">
                    <strong className="font-semibold text-slate-100">Program operations</strong> — drafting
                    announcements, summarizing threads, and surfacing follow-ups so head coaches spend less time in the
                    inbox.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300 shadow-[0_0_8px_rgba(147,197,253,0.6)]"
                    aria-hidden
                  />
                  <span className="text-slate-50">
                    <strong className="font-semibold text-slate-100">Football playbook context</strong> — lookups and
                    suggestions respect your installs, formations, and tags. Route ideas can include coaching-depth hints;
                    you always edit the final play on the canvas.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300 shadow-[0_0_8px_rgba(147,197,253,0.6)]"
                    aria-hidden
                  />
                  <span className="text-slate-50">
                    <strong className="font-semibold text-slate-100">Staff guardrails</strong> — head coaches keep
                    primary AI access; assistants are tiered with program controls. Nothing ships to players without your
                    review.
                  </span>
                </li>
              </ul>
              <p className="text-sm leading-relaxed text-slate-200">
                See how we talk about AI safety and transparency in the{" "}
                <Link href="/ai-transparency" className={landingLinkOnDark}>
                  AI transparency
                </Link>{" "}
                page.
              </p>
            </div>
            <div className="flex w-full justify-center md:ml-8 md:justify-end">
              <MarketingCard title="Judgment first" variant="dark" className="w-full max-w-md">
                <p>
                  Coach B accelerates prep and communication; it does not replace coordinators or override game
                  decisions. Metered usage keeps costs predictable as your program grows.
                </p>
              </MarketingCard>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
