"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { ScrollReveal } from "@/components/marketing/scroll-reveal"
import { HeroShatterCta } from "@/components/marketing/hero-shatter-cta"
import { LeadCaptureForm } from "@/components/marketing/lead-capture-form"
import { trackMarketingEvent } from "@/lib/utils/analytics-client"
import { MobileRootRedirect } from "@/components/marketing/mobile-root-redirect"
import { MarketingCard } from "@/components/marketing/marketing-layout"
import { ImagePlaceholder } from "@/components/marketing/image-placeholder"
import { SectionSplit } from "@/components/marketing/section-split"
import { FAQLinkCTA } from "@/components/marketing/faq-link-cta"
import {
  landingBodyDark,
  landingContainer,
  landingContainerSplit,
  landingContainerWide,
  landingDarkSection,
  landingFinalCtaSection,
  landingH2Dark,
  landingLightSection,
  landingLinkOnDark,
} from "@/lib/marketing/landing-visual-theme"

/** Light marketing sections: black headings and body copy. */
const lightSectionH2 =
  "normal-case font-athletic text-2xl font-bold tracking-tight text-black md:text-4xl"
const lightSectionLead =
  "text-base font-semibold leading-relaxed text-black md:text-lg"
const lightSectionBody = "text-base leading-relaxed text-black md:text-lg"

const heroPrimaryCta =
  "text-base px-10 py-6 w-full sm:w-auto font-semibold tracking-wide uppercase text-sm shadow-[0_8px_36px_rgba(37,99,235,0.45)] transition-all duration-200 hover:scale-[1.02] hover:shadow-[0_12px_44px_rgba(59,130,246,0.55)]"
const heroOutlineBtn =
  "text-base px-10 py-6 w-full sm:w-auto border-white/45 bg-white/[0.07] text-white backdrop-blur-md shadow-lg shadow-black/25 transition-all duration-200 hover:scale-[1.02] hover:bg-white/18 hover:border-white/60 hover:text-white"
const heroDemoBtn =
  "text-base px-10 py-6 w-full sm:w-auto font-semibold tracking-wide uppercase text-sm !bg-orange-500 !text-white border border-orange-400/50 shadow-[0_8px_28px_rgba(234,88,12,0.42)] transition-all duration-200 hover:scale-[1.02] hover:!bg-orange-400 hover:border-orange-300/55 hover:shadow-[0_12px_36px_rgba(251,146,60,0.48)] focus-visible:ring-orange-400"

export default function Home() {
  const pricingSectionRef = useRef<HTMLElement | null>(null)
  const heroValuePills = [
    "One platform for coaches, players, and families",
    "Built for Varsity + JV program structure",
    "Season-based pricing that stays budgetable",
  ]

  useEffect(() => {
    if (!pricingSectionRef.current) return
    const target = pricingSectionRef.current
    let hasTracked = false
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && !hasTracked) {
          hasTracked = true
          trackMarketingEvent("viewed_pricing", { source: "landing_page_section" })
          observer.disconnect()
        }
      },
      { threshold: 0.45 }
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      {/* Phone / tablet: skip marketing — redirect to /login or app (see MobileRootRedirect). */}
      <div className="lg:hidden">
        <MobileRootRedirect />
      </div>

    <div className="hidden min-h-screen bg-white lg:block">
      <SiteHeader />

      {/* Hero — game-day intro: field photo, layered gradients, centered hierarchy (desktop lg+) */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden text-white">
        <div
          className="absolute inset-0 scale-[1.03] bg-cover bg-center bg-no-repeat md:scale-105"
          style={{ backgroundImage: "url('/images/fog-field.png')" }}
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/80 via-slate-950/70 to-[#0a1628]/92"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-tr from-blue-600/25 via-transparent to-blue-900/10"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_120%_85%_at_50%_100%,rgba(15,23,42,0.92),transparent_55%)]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[85%] max-w-4xl -translate-x-1/2 rounded-full bg-blue-500/20 blur-[80px]"
          aria-hidden
        />
        <div className={`${landingContainerWide} flex flex-1 flex-col justify-center py-20 md:py-28 lg:py-32`}>
          <div className="mx-auto max-w-4xl space-y-12 text-center">
            <ScrollReveal>
              <div className="space-y-7">
                <h1 className="font-athletic text-5xl font-bold uppercase leading-[0.98] tracking-[-0.02em] text-white drop-shadow-[0_4px_36px_rgba(0,0,0,0.55)] sm:text-6xl md:text-7xl lg:text-8xl">
                  Braik the busywork.
                  <br />
                  <span className="inline-block bg-gradient-to-r from-blue-200 via-white to-blue-100 bg-clip-text pb-0.5 text-transparent drop-shadow-[0_2px_24px_rgba(59,130,246,0.45)]">
                    Run the team.
                  </span>
                </h1>
                <p className="mx-auto max-w-2xl text-lg font-medium leading-relaxed text-white/92 md:text-xl">
                  Your AI Operations Coach for Every Season.
                  <br />
                  <span className="font-semibold text-white drop-shadow-sm">Braik the Chaos.</span>
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  {heroValuePills.map((pill) => (
                    <span
                      key={pill}
                      className="inline-flex items-center rounded-full border border-white/25 bg-white/[0.08] px-4 py-2 text-sm font-medium text-white/95 shadow-lg shadow-black/20 ring-1 ring-white/15 backdrop-blur-md"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
                <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/78">
                  <span className="font-semibold text-white/92">Football-first today</span> — Braik is built around how football
                  programs operate. Additional sports may follow as the platform matures.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <HeroShatterCta
                  size="lg"
                  className={heroPrimaryCta}
                  onAnimationStart={() => trackMarketingEvent("clicked_cta", { cta: "get_started_hero" })}
                />
                <Link
                  href="/pricing"
                  onClick={() => trackMarketingEvent("clicked_cta", { cta: "view_pricing_hero" })}
                >
                  <Button size="lg" variant="outline" className={heroOutlineBtn}>
                    View pricing
                  </Button>
                </Link>
                <Link
                  href="/#request-demo"
                  onClick={() => trackMarketingEvent("clicked_cta", { cta: "request_demo_hero" })}
                >
                  <Button size="lg" variant="default" className={heroDemoBtn}>
                    Request demo
                  </Button>
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={200}>
              <div className="border-t border-white/20 pt-14">
                <p className="text-sm font-medium text-white/72">
                  Returning to Braik?{" "}
                  <Link href="/login" className="font-semibold text-blue-200 underline decoration-blue-300/60 underline-offset-4 transition hover:text-white hover:decoration-white">
                    Sign in here
                  </Link>
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Coach Reality Validation — dark / momentum */}
      <section className={landingDarkSection}>
        <div className={landingContainer}>
          <div className="mx-auto max-w-3xl">
            <ScrollReveal>
              <div className="space-y-10">
                <h2 className={`${landingH2Dark} text-center`}>
                  Coaches today are expected to do far more than coach.
                </h2>
                <div className={`space-y-6 pt-4 ${landingBodyDark}`}>
                  <p>
                    They manage rosters, schedules, payments, communication, documents, parents, assistants, and increasingly complex software—often with limited staff and even less time.
                  </p>
                  <p>
                    Most programs are forced to stitch together multiple tools for scheduling, communication, payments, and team coordination. The result is fragmented communication, duplicated work, confusion for parents and players, and added stress for coaches.
                  </p>
                  <p className="text-xl font-semibold text-white md:text-2xl">
                    Braik exists to change that.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Reframing Braik — light / clarity; device mockup (image left on desktop, text first on mobile) */}
      <section className={landingLightSection}>
        <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-slate-50/80 to-white" aria-hidden />
        <div className={landingContainerSplit}>
          <ScrollReveal>
            <SectionSplit>
              <div className="order-2 flex min-w-0 justify-center md:order-1 md:justify-start">
                <img
                  src="/images/devices-transparent.png"
                  alt="Braik app across devices"
                  className="h-auto w-full max-w-2xl object-contain drop-shadow-2xl"
                />
              </div>
              <div className="order-1 min-w-0 space-y-8 md:order-2">
                <h2 className={lightSectionH2}>One system. Less stress.</h2>
                <div className="space-y-6 pt-2">
                  <p className={lightSectionLead}>
                    Most coaches don't need more apps. They need fewer responsibilities pulling them away from what matters.
                  </p>
                  <p className={lightSectionBody}>
                    Instead of juggling spreadsheets, group texts, payment platforms, and document folders, Braik brings everything into one system—designed around the head coach's workflow.
                  </p>
                  <p className={lightSectionBody}>
                    Braik steps in as a unified system and support layer, helping programs operate smoothly while allowing coaches to focus on coaching.
                  </p>
                </div>
              </div>
            </SectionSplit>
          </ScrollReveal>
        </div>
      </section>

      {/* Built for Real Program Constraints — dark */}
      <section ref={pricingSectionRef} className={landingDarkSection}>
        <div className={landingContainer}>
          <div className="mx-auto max-w-3xl">
            <ScrollReveal>
              <div className="space-y-10">
                <h2 className={`${landingH2Dark} text-center`}>Built for real program constraints</h2>
                <div className={`space-y-6 pt-4 ${landingBodyDark}`}>
                  <p>
                    Braik was designed with a clear reality in mind: coaching staffs are limited, budgets are tight, and expectations remain high.
                  </p>
                  <p>
                    Rather than pushing premium pricing or locking teams into rigid plans, Braik is structured to stay accessible for real programs—especially at the high school level. The platform is built to grow with your program, not force you to overpay for features you don't need.
                  </p>
                  <p>
                    Braik is billed per season, aligned with team dues and seasonal planning. It's budgetable, intentional, and built for programs that need structure without complexity.
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
      </section>

      {/* Varsity & JV Program Structure — light (text left / placeholder right on desktop) */}
      <section className={landingLightSection}>
        <div className={landingContainerSplit}>
          <ScrollReveal>
            <SectionSplit>
              <div className="min-w-0 space-y-8">
                <h2 className={lightSectionH2}>Built for entire programs — Varsity and JV</h2>
                <div className="space-y-6 pt-2">
                  <p className={lightSectionBody}>
                    Most athletic programs don't operate as a single roster. Varsity and JV teams often share resources, staff, and schedules—but are forced into separate systems or duplicate subscriptions.
                  </p>
                  <p className={lightSectionBody}>
                    Braik was built to reflect how programs actually function. Varsity and JV teams are managed under one program, giving coaches a unified system without sacrificing team-level autonomy.
                  </p>
                  <p className={lightSectionBody}>
                    Varsity Head Coaches manage the full program and can create and configure JV teams, assign JV Head Coaches, and maintain program-level oversight. JV Head Coaches have full authority over their own team dashboards, schedules, communication, and players, but cannot access or override Varsity teams or program-level settings.
                  </p>
                  <p className={lightSectionBody}>
                    This structure keeps programs unified while respecting clear lines of responsibility and authority.
                  </p>
                </div>
              </div>
              <div className="min-w-0">
                <ImagePlaceholder />
              </div>
            </SectionSplit>
          </ScrollReveal>
        </div>
      </section>

      {/* High-Level Capabilities — dark */}
      <section className={landingDarkSection}>
        <div className={landingContainer}>
          <div className="mx-auto max-w-5xl">
            <ScrollReveal>
              <h2 className={`${landingH2Dark} mb-12 text-center md:mb-16`}>Core operational areas</h2>
            </ScrollReveal>

            <div className="grid gap-6 md:grid-cols-2">
              <ScrollReveal delay={0} className="h-full">
                <MarketingCard title="Communication" variant="dark" className="h-full">
                  <p>
                    Targeted messaging and announcements that keep everyone informed without overwhelming anyone. The right people see the right information, automatically.
                  </p>
                </MarketingCard>
              </ScrollReveal>

              <ScrollReveal delay={50} className="h-full">
                <MarketingCard title="Scheduling" variant="dark" className="h-full">
                  <p>
                    Calendar management with RSVPs and event coordination. Everyone sees what they need to see, when they need to see it.
                  </p>
                </MarketingCard>
              </ScrollReveal>

              <ScrollReveal delay={100} className="h-full">
                <MarketingCard title="Payments" variant="dark" className="h-full">
                  <p>
                    Season-based dues collection and coach-collected payments with clear tracking and accountability. Know who&apos;s paid, who hasn&apos;t, and what&apos;s outstanding.
                  </p>
                </MarketingCard>
              </ScrollReveal>

              <ScrollReveal delay={150} className="h-full">
                <MarketingCard title="Documents" variant="dark" className="h-full">
                  <p>
                    Centralized playbooks, installs, and program resources. Organized by unit and position, with acknowledgement tracking for important materials.
                  </p>
                </MarketingCard>
              </ScrollReveal>

              <ScrollReveal delay={200} className="h-full">
                <MarketingCard title="Inventory" variant="dark" className="h-full">
                  <p>
                    Equipment tracking and assignment for team-issued gear. Know what you have, where it is, and who&apos;s responsible for it.
                  </p>
                </MarketingCard>
              </ScrollReveal>

              <ScrollReveal delay={250} className="h-full">
                <MarketingCard title="Roster Management" variant="dark" className="h-full">
                  <p>
                    Player tracking, position management, and depth charts. Everything organized the way your program actually operates.
                  </p>
                </MarketingCard>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      {/* Role-Based Value — light: split intro + card grid */}
      <section className={landingLightSection}>
        <div className={landingContainerSplit}>
          <ScrollReveal>
            <SectionSplit className="items-start md:items-center">
              <div className="order-2 min-w-0 md:order-1">
                <ImagePlaceholder />
              </div>
              <div className="order-1 min-w-0 space-y-6 md:order-2">
                <h2 className={lightSectionH2}>What you get by role</h2>
                <p className={lightSectionBody}>
                  Head coaches, assistants, players, and parents each get a clear, scoped experience.
                </p>
              </div>
            </SectionSplit>
          </ScrollReveal>
          <div className="mt-14 grid gap-6 md:mt-16 md:grid-cols-2">
            {[
              {
                role: "Head Coach",
                details: "Full program oversight, roster and permissions control, collections and operational visibility for Varsity + JV.",
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
            ].map((item, index) => (
              <ScrollReveal key={item.role} delay={index * 50} className="h-full">
                <MarketingCard title={item.role} className="h-full">
                  <p className="text-black">{item.details}</p>
                </MarketingCard>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* AI & Coach B — dark (text left / card right on md+) */}
      <section className={landingDarkSection}>
        <div className={landingContainer}>
            <ScrollReveal>
              <div className="grid items-center gap-12 md:grid-cols-2">
                <div className="space-y-8">
                  <h2 className={landingH2Dark}>AI that stays inside the huddle</h2>
                  <p className="text-lg leading-relaxed text-slate-50 md:text-xl">
                    Coach B is Braik&apos;s AI layer for football programs: it reasons over the same roster, schedule, playbook, and
                    health context your staff already maintains—so answers stay grounded in your team, not generic internet noise.
                  </p>
                  <ul className="list-none space-y-4 pl-0 text-base leading-relaxed text-slate-50 md:text-lg">
                    <li className="flex gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300 shadow-[0_0_8px_rgba(147,197,253,0.6)]" aria-hidden />
                      <span className="text-slate-50">
                        <strong className="font-semibold text-white">Program operations</strong> — drafting announcements, summarizing threads,
                        and surfacing follow-ups so head coaches spend less time in the inbox.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300 shadow-[0_0_8px_rgba(147,197,253,0.6)]" aria-hidden />
                      <span className="text-slate-50">
                        <strong className="font-semibold text-white">Football playbook context</strong> — lookups and suggestions respect your
                        installs, formations, and tags. Route ideas can include coaching-depth hints; you always edit the final play on
                        the canvas.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300 shadow-[0_0_8px_rgba(147,197,253,0.6)]" aria-hidden />
                      <span className="text-slate-50">
                        <strong className="font-semibold text-white">Staff guardrails</strong> — head coaches keep primary AI access; assistants
                        are tiered with program controls. Nothing ships to players without your review.
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
                      Coach B accelerates prep and communication; it does not replace coordinators or override game decisions. Metered
                      usage keeps costs predictable as your program grows.
                    </p>
                  </MarketingCard>
                </div>
              </div>
            </ScrollReveal>
        </div>
      </section>

      <FAQLinkCTA id="faq" imagePosition="right" />

      {/* Final CTA — bold conversion band */}
      <section className={landingFinalCtaSection}>
        <div className={landingContainer}>
          <div className="mx-auto max-w-3xl text-center">
            <ScrollReveal>
              <div className="space-y-10">
                <h2 className={`${landingH2Dark} text-balance`}>See if Braik fits your program</h2>
                <div className={`space-y-6 pt-2 ${landingBodyDark}`}>
                  <p>
                    Braik was built to support coaches who are stretched thin, giving them the tools—and the help—they need to run their programs without sacrificing focus, organization, or time with their team.
                  </p>
                  <p>
                    If you're running a program where organization, communication, and accountability matter—but time and staffing are limited—Braik is built for you.
                  </p>
                </div>
                <div className="pt-6">
                  <HeroShatterCta
                    size="lg"
                    className={heroPrimaryCta}
                    onAnimationStart={() => trackMarketingEvent("clicked_cta", { cta: "get_started_final" })}
                  />
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Request Demo — light (form + copy right / placeholder left on desktop; form first on mobile) */}
      <section id="request-demo" className={landingLightSection}>
        <div className={landingContainerSplit}>
          <ScrollReveal>
            <SectionSplit className="items-start">
              <div className="order-2 min-w-0 md:order-1">
                <ImagePlaceholder aspect="video" />
              </div>
              <div className="order-1 min-w-0 space-y-6 md:order-2">
                <h2 className={lightSectionH2}>Request a demo</h2>
                <p className={lightSectionBody}>
                  Share your program details and we will follow up with a tailored Braik walkthrough.
                </p>
                <LeadCaptureForm />
              </div>
            </SectionSplit>
          </ScrollReveal>
        </div>
      </section>

      <SiteFooter />
    </div>
    </>
  )
}
