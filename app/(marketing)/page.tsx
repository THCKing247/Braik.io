"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { ScrollReveal } from "@/components/marketing/scroll-reveal"
import { HeroShatterCta } from "@/components/marketing/hero-shatter-cta"
import { LeadCaptureForm } from "@/components/marketing/lead-capture-form"
import { trackMarketingEvent } from "@/lib/utils/analytics-client"
import { MobileRootRedirect } from "@/components/marketing/mobile-root-redirect"
import { MarketingFaqAccordion } from "@/components/marketing/marketing-faq-accordion"
import { MARKETING_FAQ_ENTRIES } from "@/lib/marketing/faq-content"
import { MarketingCard } from "@/components/marketing/marketing-layout"
import { LandingHudOverlay } from "@/components/marketing/landing-hud-overlay"
import {
  landingAccentText,
  landingBodyDark,
  landingBodyLight,
  landingContainer,
  landingContainerWide,
  landingCtaJoinNavy,
  landingCtaPricingOutline,
  landingCtaPrimaryOrange,
  landingDarkSection,
  landingFinalCtaSection,
  landingH2Dark,
  landingH2Light,
  landingLightSection,
  landingLinkOnDark,
  landingLinkOnLight,
} from "@/lib/marketing/landing-visual-theme"
import { cn } from "@/lib/utils"

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

      {/* Hero — field photo, HUD overlay, navy wash, orange-accent CTAs (desktop lg+) */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden text-white">
        <div
          className="absolute inset-0 z-0 scale-[1.03] bg-cover bg-center bg-no-repeat md:scale-105"
          style={{ backgroundImage: "url('/images/fog-field.png')" }}
          aria-hidden
        />
        <div
          className="absolute inset-0 z-[1] bg-gradient-to-b from-[rgba(10,10,20,0.88)] via-slate-950/78 to-[#05080f]/95"
          aria-hidden
        />
        <div
          className="absolute inset-0 z-[2] bg-gradient-to-tr from-blue-600/20 via-transparent to-blue-950/15"
          aria-hidden
        />
        <div
          className="absolute inset-0 z-[3] bg-[radial-gradient(ellipse_120%_85%_at_50%_100%,rgba(5,8,15,0.94),transparent_55%)]"
          aria-hidden
        />
        <LandingHudOverlay className="z-[4]" />
        <div
          className="pointer-events-none absolute -top-24 left-1/2 z-[5] h-48 w-[85%] max-w-4xl -translate-x-1/2 rounded-full bg-[#FF6A00]/12 blur-[90px]"
          aria-hidden
        />
        <div className={`${landingContainerWide} relative z-10 flex flex-1 flex-col justify-center py-20 md:py-28 lg:py-32`}>
          <div className="mx-auto max-w-4xl space-y-12 text-center">
            <ScrollReveal>
              <div className="space-y-7">
                <h1 className="font-athletic text-5xl font-bold uppercase leading-[0.98] tracking-[-0.02em] text-white drop-shadow-[0_4px_36px_rgba(0,0,0,0.55)] sm:text-6xl md:text-7xl lg:text-8xl">
                  <span className={landingAccentText}>Braik</span> the busywork.
                  <br />
                  <span className="inline-block bg-gradient-to-r from-[#FF9A4D] via-white to-blue-200/90 bg-clip-text pb-0.5 text-transparent drop-shadow-[0_2px_28px_rgba(255,106,0,0.35)]">
                    Run the team.
                  </span>
                </h1>
                <p className="mx-auto max-w-2xl text-lg font-medium leading-relaxed text-white/90 md:text-xl">
                  Your <span className={landingAccentText}>AI</span> Operations Coach for Every Season.
                  <br />
                  <span className="font-semibold text-white drop-shadow-sm">
                    <span className={landingAccentText}>Braik</span> the Chaos.
                  </span>
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  {heroValuePills.map((pill) => (
                    <span
                      key={pill}
                      className="inline-flex items-center rounded-full border border-white/20 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white/95 shadow-lg shadow-black/25 ring-1 ring-[#FF6A00]/20 backdrop-blur-md"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
                <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-300/95">
                  <span className={landingAccentText}>Football-first</span> today —{" "}
                  <span className={landingAccentText}>Braik</span> is built around how{" "}
                  <span className={landingAccentText}>football</span> programs operate. Additional sports may follow as the platform
                  matures.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:flex-wrap">
                <Link
                  href="/#request-demo"
                  className={cn(landingCtaPrimaryOrange, "w-full sm:w-auto text-center")}
                  onClick={() => trackMarketingEvent("clicked_cta", { cta: "request_demo_hero" })}
                >
                  Request demo
                </Link>
                <HeroShatterCta
                  size="lg"
                  className={landingCtaJoinNavy}
                  onAnimationStart={() => trackMarketingEvent("clicked_cta", { cta: "get_started_hero" })}
                />
                <Link
                  href="/pricing"
                  className={cn(landingCtaPricingOutline, "w-full sm:w-auto text-center")}
                  onClick={() => trackMarketingEvent("clicked_cta", { cta: "view_pricing_hero" })}
                >
                  View pricing
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={200}>
              <div className="border-t border-white/15 pt-14">
                <p className="text-sm font-medium text-slate-400">
                  Returning to Braik?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-[#FF9A4D] underline decoration-[#FF6A00]/50 underline-offset-4 transition hover:text-white hover:decoration-white"
                  >
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
        <LandingHudOverlay className="z-[1]" />
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
                    <span className={landingAccentText}>Braik</span> exists to change that.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Reframing Braik — light / clarity (future: optional absolute bg image + overlay) */}
      <section className={landingLightSection}>
        <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-slate-50/80 to-white" aria-hidden />
        <div className={landingContainer}>
            <ScrollReveal>
              <div className="grid items-center gap-12 md:grid-cols-2">
                <div className="order-2 flex justify-center md:order-1 md:justify-start">
                  <img
                    src="/diagram-hero-page-1.png"
                    alt="Braik system diagram"
                    className="h-auto max-w-full object-contain drop-shadow-xl"
                    style={{ maxHeight: "1500px", width: "auto" }}
                  />
                </div>
                <div className="order-1 space-y-8 md:order-2">
                  <h2 className={landingH2Light}>One system. Less stress.</h2>
                  <div className={`space-y-6 pt-2 ${landingBodyLight}`}>
                    <p className="text-xl font-semibold text-slate-900 md:text-2xl">
                      Most coaches don't need more apps. They need fewer responsibilities pulling them away from what matters.
                    </p>
                    <p>
                      Instead of juggling spreadsheets, group texts, payment platforms, and document folders,{" "}
                      <span className={landingAccentText}>Braik</span> brings everything into one system—designed around the head
                      coach's workflow.
                    </p>
                    <p>
                      <span className={landingAccentText}>Braik</span> steps in as a unified system and support layer, helping
                      programs operate smoothly while allowing coaches to focus on coaching.
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
        </div>
      </section>

      {/* Built for Real Program Constraints — dark */}
      <section ref={pricingSectionRef} className={landingDarkSection}>
        <LandingHudOverlay className="z-[1]" />
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

      {/* Varsity & JV Program Structure — light */}
      <section className={landingLightSection}>
        <div className={landingContainer}>
          <div className="mx-auto max-w-3xl">
            <ScrollReveal>
              <div className="space-y-10">
                <h2 className={`${landingH2Light} text-center`}>
                  Built for entire programs — Varsity and JV
                </h2>
                <div className={`space-y-6 pt-4 ${landingBodyLight}`}>
                  <p>
                    Most athletic programs don't operate as a single roster. Varsity and JV teams often share resources, staff, and schedules—but are forced into separate systems or duplicate subscriptions.
                  </p>
                  <p>
                    Braik was built to reflect how programs actually function. Varsity and JV teams are managed under one program, giving coaches a unified system without sacrificing team-level autonomy.
                  </p>
                  <p>
                    Varsity Head Coaches manage the full program and can create and configure JV teams, assign JV Head Coaches, and maintain program-level oversight. JV Head Coaches have full authority over their own team dashboards, schedules, communication, and players, but cannot access or override Varsity teams or program-level settings.
                  </p>
                  <p>
                    This structure keeps programs unified while respecting clear lines of responsibility and authority.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* High-Level Capabilities — dark */}
      <section className={landingDarkSection}>
        <LandingHudOverlay className="z-[1]" />
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

      {/* Role-Based Value — light */}
      <section className={landingLightSection}>
        <div className={landingContainer}>
            <ScrollReveal>
              <h2 className={`${landingH2Light} mb-12 text-center md:mb-16`}>What you get by role</h2>
            </ScrollReveal>
            <div className="grid md:grid-cols-2 gap-6">
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
                    <p>{item.details}</p>
                  </MarketingCard>
                </ScrollReveal>
              ))}
            </div>
        </div>
      </section>

      {/* AI & Coach B — dark (text left / card right on md+) */}
      <section className={landingDarkSection}>
        <LandingHudOverlay className="z-[1]" />
        <div className={landingContainer}>
            <ScrollReveal>
              <div className="grid items-center gap-12 md:grid-cols-2">
                <div className="space-y-8">
                  <h2 className={landingH2Dark}>
                    <span className={landingAccentText}>AI</span> that stays inside the huddle
                  </h2>
                  <p className={landingBodyDark}>
                    Coach B is <span className={landingAccentText}>Braik</span>&apos;s AI layer for{" "}
                    <span className={landingAccentText}>football</span> programs: it reasons over the same roster, schedule, playbook,
                    and health context your staff already maintains—so answers stay grounded in your team, not generic internet noise.
                  </p>
                  <ul className="list-none space-y-4 pl-0 text-base leading-relaxed text-slate-200/95">
                    <li className="flex gap-3">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6A00] shadow-[0_0_10px_rgba(255,106,0,0.55)]"
                        aria-hidden
                      />
                      <span>
                        <strong className="text-white">Program operations</strong> — drafting announcements, summarizing threads,
                        and surfacing follow-ups so head coaches spend less time in the inbox.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6A00] shadow-[0_0_10px_rgba(255,106,0,0.55)]"
                        aria-hidden
                      />
                      <span>
                        <strong className="text-white">Football playbook context</strong> — lookups and suggestions respect your
                        installs, formations, and tags. Route ideas can include coaching-depth hints; you always edit the final play on
                        the canvas.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#60a5fa]/90 shadow-[0_0_8px_rgba(96,165,250,0.45)]"
                        aria-hidden
                      />
                      <span>
                        <strong className="text-white">Staff guardrails</strong> — head coaches keep primary AI access; assistants
                        are tiered with program controls. Nothing ships to players without your review.
                      </span>
                    </li>
                  </ul>
                  <p className="text-sm text-slate-300/95">
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

      {/* FAQ — light */}
      <section id="faq" className={landingLightSection}>
        <div className={landingContainer}>
          <div className="mx-auto max-w-3xl">
            <ScrollReveal>
              <h2 className={`${landingH2Light} mb-4 text-center`}>Frequently asked questions</h2>
              <p className={`mb-10 text-center ${landingBodyLight}`}>
                Quick answers with links when there&apos;s more detail on another page — including{" "}
                <Link href="/pricing#core-platform" className={landingLinkOnLight}>
                  how Braik is priced
                </Link>
                .
              </p>
            </ScrollReveal>
            <MarketingFaqAccordion entries={MARKETING_FAQ_ENTRIES} />
            <p className="text-center mt-10 text-sm text-slate-500">
              <Link href="/faq" className={landingLinkOnLight}>
                View all FAQs
              </Link>{" "}
              ·{" "}
              <Link href="/pricing" className={landingLinkOnLight}>
                Pricing
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA — bold conversion band */}
      <section className={landingFinalCtaSection}>
        <LandingHudOverlay className="z-[1]" />
        <div className={landingContainer}>
          <div className="mx-auto max-w-3xl text-center">
            <ScrollReveal>
              <div className="space-y-10">
                <h2 className={`${landingH2Dark} text-balance`}>
                  See if <span className={landingAccentText}>Braik</span> fits your program
                </h2>
                <div className={`space-y-6 pt-2 ${landingBodyDark}`}>
                  <p>
                    <span className={landingAccentText}>Braik</span> was built to support coaches who are stretched thin, giving them
                    the tools—and the help—they need to run their programs without sacrificing focus, organization, or time with their
                    team.
                  </p>
                  <p>
                    If you're running a program where organization, communication, and accountability matter—but time and staffing
                    are limited—<span className={landingAccentText}>Braik</span> is built for you.
                  </p>
                </div>
                <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row sm:flex-wrap">
                  <Link
                    href="/#request-demo"
                    className={cn(landingCtaPrimaryOrange, "w-full sm:w-auto text-center")}
                    onClick={() => trackMarketingEvent("clicked_cta", { cta: "request_demo_final" })}
                  >
                    Request a demo
                  </Link>
                  <HeroShatterCta
                    size="lg"
                    className={landingCtaJoinNavy}
                    onAnimationStart={() => trackMarketingEvent("clicked_cta", { cta: "get_started_final" })}
                  />
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Request Demo — light */}
      <section id="request-demo" className={landingLightSection}>
        <div className={landingContainer}>
          <div className="mx-auto max-w-3xl">
            <ScrollReveal>
              <div className="space-y-6">
                <h2 className={`${landingH2Light} text-center`}>Request a demo</h2>
                <p className={`text-center ${landingBodyLight}`}>
                  Share your program details and we will follow up with a tailored Braik walkthrough.
                </p>
                <LeadCaptureForm />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
    </>
  )
}
