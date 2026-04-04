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
import { MarketingFaqAccordion } from "@/components/marketing/marketing-faq-accordion"
import { MARKETING_FAQ_ENTRIES } from "@/lib/marketing/faq-content"
import { MarketingCard } from "@/components/marketing/marketing-layout"

/** Alternating landing rhythm: consistent vertical padding, full-width bands. */
const sectionY = "py-20 md:py-24"
/** Blue (brand) section — content column */
const blueBand = `w-full bg-blue-600 text-white ${sectionY}`
/** White section — shell is `relative` for optional future full-bleed imagery */
const whiteBand = `relative w-full bg-white text-gray-900 ${sectionY}`

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

      {/* Hero Identity Section — full-viewport photo + gradient overlay (desktop lg+) */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden text-white">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/images/fog-field.png')" }}
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/40"
          aria-hidden
        />
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 md:py-28 lg:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-12">
            <ScrollReveal>
              <div className="space-y-7">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-athletic font-bold text-white uppercase tracking-tight leading-[1.08] drop-shadow-sm">
                  Braik the busywork.
                  <br />
                  <span className="text-[#93C5FD]">Run the team.</span>
                </h1>
                <p className="text-lg md:text-xl text-white/90 font-medium max-w-2xl mx-auto leading-relaxed">
                  Your AI Operations Coach for Every Season.
                  <br />
                  <span className="font-semibold text-white">Braik the Chaos.</span>
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  {heroValuePills.map((pill) => (
                    <span
                      key={pill}
                      className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white/95 backdrop-blur-sm"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-white/75 max-w-xl mx-auto leading-relaxed">
                  <span className="font-semibold text-white/90">Football-first today</span> — Braik is built around how football
                  programs operate. Additional sports may follow as the platform matures.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                <HeroShatterCta
                  size="lg"
                  className="text-base px-10 py-6 w-full sm:w-auto shadow-lg shadow-black/20"
                  onAnimationStart={() => trackMarketingEvent("clicked_cta", { cta: "get_started_hero" })}
                />
                <Link
                  href="/pricing"
                  onClick={() => trackMarketingEvent("clicked_cta", { cta: "view_pricing_hero" })}
                >
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-base px-10 py-6 w-full sm:w-auto border-white/50 bg-white/5 text-white backdrop-blur-sm hover:bg-white/15 hover:text-white"
                  >
                    View pricing
                  </Button>
                </Link>
                <Link
                  href="/#request-demo"
                  onClick={() => trackMarketingEvent("clicked_cta", { cta: "request_demo_hero" })}
                >
                  <Button
                    size="lg"
                    variant="ghost"
                    className="text-base px-10 py-6 w-full sm:w-auto text-white/90 hover:text-white hover:bg-white/10"
                  >
                    Request demo
                  </Button>
                </Link>
              </div>
            </ScrollReveal>

            {/* Returning User Login - Visually De-emphasized */}
            <ScrollReveal delay={200}>
              <div className="pt-16 border-t border-white/20">
                <p className="text-sm text-white/70 font-medium">
                  Returning to Braik?{" "}
                  <Link href="/login" className="text-[#93C5FD] hover:text-white hover:underline">
                    Sign in here
                  </Link>
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Coach Reality Validation — blue */}
      <section className={blueBand}>
        <div className="mx-auto max-w-6xl px-4">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <div className="space-y-8">
                <h2 className="text-4xl md:text-5xl font-athletic font-bold text-white uppercase tracking-tight text-center leading-tight">
                  Coaches today are expected to do far more than coach.
                </h2>
                <div className="space-y-6 text-lg text-blue-50 leading-relaxed pt-8">
                  <p>
                    They manage rosters, schedules, payments, communication, documents, parents, assistants, and increasingly complex software—often with limited staff and even less time.
                  </p>
                  <p>
                    Most programs are forced to stitch together multiple tools for scheduling, communication, payments, and team coordination. The result is fragmented communication, duplicated work, confusion for parents and players, and added stress for coaches.
                  </p>
                  <p className="text-white font-semibold text-xl">
                    Braik exists to change that.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Reframing Braik — white (future: optional bg image + overlay in this section) */}
      <section className={whiteBand}>
        {/* Future: absolute inset-0 bg-cover bg-center bg-no-repeat + overlay e.g. bg-black/30 */}
        <div className="relative z-10 mx-auto max-w-6xl px-4">
            <ScrollReveal>
              <div className="grid md:grid-cols-2 gap-12 items-center">
                {/* Image on the left */}
                <div className="order-2 md:order-1 flex justify-center md:justify-start">
                  <img 
                    src="/diagram-hero-page-1.png" 
                    alt="Braik system diagram" 
                    className="max-w-full h-auto object-contain"
                    style={{ maxHeight: '1500px', width: 'auto' }}
                  />
                </div>
                {/* Content on the right */}
                <div className="space-y-8 order-1 md:order-2">
                  <h2 className="text-4xl md:text-5xl font-athletic font-bold text-gray-900 uppercase tracking-tight leading-tight">
                    One system. Less stress.
                  </h2>
                  <div className="space-y-6 text-lg text-gray-700 leading-relaxed pt-8">
                    <p className="text-xl font-medium text-gray-900">
                      Most coaches don't need more apps. They need fewer responsibilities pulling them away from what matters.
                    </p>
                    <p>
                      Instead of juggling spreadsheets, group texts, payment platforms, and document folders, Braik brings everything into one system—designed around the head coach's workflow.
                    </p>
                    <p>
                      Braik steps in as a unified system and support layer, helping programs operate smoothly while allowing coaches to focus on coaching.
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
        </div>
      </section>

      {/* Built for Real Program Constraints — blue */}
      <section ref={pricingSectionRef} className={blueBand}>
        <div className="mx-auto max-w-6xl px-4">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <div className="space-y-8">
                <h2 className="text-4xl md:text-5xl font-athletic font-bold text-white uppercase tracking-tight text-center leading-tight">
                  Built for real program constraints
                </h2>
                <div className="space-y-6 text-lg text-blue-50 leading-relaxed pt-8">
                  <p>
                    Braik was designed with a clear reality in mind: coaching staffs are limited, budgets are tight, and expectations remain high.
                  </p>
                  <p>
                    Rather than pushing premium pricing or locking teams into rigid plans, Braik is structured to stay accessible for real programs—especially at the high school level. The platform is built to grow with your program, not force you to overpay for features you don't need.
                  </p>
                  <p>
                    Braik is billed per season, aligned with team dues and seasonal planning. It's budgetable, intentional, and built for programs that need structure without complexity.
                  </p>
                  <p className="text-center pt-2">
                    <Link href="/pricing" className="text-white font-semibold underline decoration-blue-200/80 underline-offset-4 hover:text-blue-100">
                      View full pricing →
                    </Link>
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Varsity & JV Program Structure — white */}
      <section className={whiteBand}>
        <div className="relative z-10 mx-auto max-w-6xl px-4">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <div className="space-y-8">
                <h2 className="text-4xl md:text-5xl font-athletic font-bold text-gray-900 uppercase tracking-tight text-center leading-tight">
                  Built for entire programs — Varsity and JV
                </h2>
                <div className="space-y-6 text-lg text-gray-700 leading-relaxed pt-8">
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

      {/* High-Level Capabilities — blue */}
      <section className={blueBand}>
        <div className="mx-auto max-w-6xl px-4">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <h2 className="text-4xl md:text-5xl font-athletic font-bold text-white uppercase tracking-tight text-center mb-10 md:mb-14">
                Core operational areas
              </h2>
            </ScrollReveal>

            <div className="grid md:grid-cols-2 gap-6">
              <ScrollReveal delay={0} className="h-full">
                <MarketingCard title="Communication" className="h-full">
                  <p>
                    Targeted messaging and announcements that keep everyone informed without overwhelming anyone. The right people see the right information, automatically.
                  </p>
                </MarketingCard>
              </ScrollReveal>

              <ScrollReveal delay={50} className="h-full">
                <MarketingCard title="Scheduling" className="h-full">
                  <p>
                    Calendar management with RSVPs and event coordination. Everyone sees what they need to see, when they need to see it.
                  </p>
                </MarketingCard>
              </ScrollReveal>

              <ScrollReveal delay={100} className="h-full">
                <MarketingCard title="Payments" className="h-full">
                  <p>
                    Season-based dues collection and coach-collected payments with clear tracking and accountability. Know who&apos;s paid, who hasn&apos;t, and what&apos;s outstanding.
                  </p>
                </MarketingCard>
              </ScrollReveal>

              <ScrollReveal delay={150} className="h-full">
                <MarketingCard title="Documents" className="h-full">
                  <p>
                    Centralized playbooks, installs, and program resources. Organized by unit and position, with acknowledgement tracking for important materials.
                  </p>
                </MarketingCard>
              </ScrollReveal>

              <ScrollReveal delay={200} className="h-full">
                <MarketingCard title="Inventory" className="h-full">
                  <p>
                    Equipment tracking and assignment for team-issued gear. Know what you have, where it is, and who&apos;s responsible for it.
                  </p>
                </MarketingCard>
              </ScrollReveal>

              <ScrollReveal delay={250} className="h-full">
                <MarketingCard title="Roster Management" className="h-full">
                  <p>
                    Player tracking, position management, and depth charts. Everything organized the way your program actually operates.
                  </p>
                </MarketingCard>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      {/* Role-Based Value — white */}
      <section className={whiteBand}>
        <div className="relative z-10 mx-auto max-w-6xl px-4">
            <ScrollReveal>
              <h2 className="text-4xl md:text-5xl font-athletic font-bold text-gray-900 uppercase tracking-tight text-center mb-10 md:mb-14">
                What you get by role
              </h2>
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

      {/* AI & Coach B — blue (text left / card right on md+) */}
      <section className={blueBand}>
        <div className="mx-auto max-w-6xl px-4">
            <ScrollReveal>
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="space-y-8">
                  <h2 className="text-4xl md:text-5xl font-athletic font-bold text-white uppercase tracking-tight leading-tight">
                    AI that stays inside the huddle
                  </h2>
                  <p className="text-lg text-blue-50 leading-relaxed">
                    Coach B is Braik&apos;s AI layer for football programs: it reasons over the same roster, schedule, playbook, and
                    health context your staff already maintains—so answers stay grounded in your team, not generic internet noise.
                  </p>
                  <ul className="space-y-4 text-blue-50 text-base leading-relaxed list-none pl-0">
                    <li className="flex gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-200" aria-hidden />
                      <span>
                        <strong className="text-white">Program operations</strong> — drafting announcements, summarizing threads,
                        and surfacing follow-ups so head coaches spend less time in the inbox.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-200" aria-hidden />
                      <span>
                        <strong className="text-white">Football playbook context</strong> — lookups and suggestions respect your
                        installs, formations, and tags. Route ideas can include coaching-depth hints; you always edit the final play on
                        the canvas.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-200" aria-hidden />
                      <span>
                        <strong className="text-white">Staff guardrails</strong> — head coaches keep primary AI access; assistants
                        are tiered with program controls. Nothing ships to players without your review.
                      </span>
                    </li>
                  </ul>
                  <p className="text-sm text-blue-100/90">
                    See how we talk about AI safety and transparency in the{" "}
                    <Link href="/ai-transparency" className="text-white font-medium underline underline-offset-4 hover:text-blue-100">
                      AI transparency
                    </Link>{" "}
                    page.
                  </p>
                </div>
                <div className="flex justify-center md:justify-end md:ml-8 w-full">
                  <MarketingCard title="Judgment first" className="w-full max-w-md">
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

      {/* FAQ — white */}
      <section id="faq" className={whiteBand}>
        <div className="relative z-10 mx-auto max-w-6xl px-4">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <h2 className="text-4xl md:text-5xl font-athletic font-bold text-gray-900 uppercase tracking-tight text-center mb-4">
                Frequently asked questions
              </h2>
              <p className="text-center text-gray-700 mb-10">
                Quick answers with links when there&apos;s more detail on another page — including{" "}
                <Link href="/pricing#core-platform" className="text-[#2563EB] font-medium hover:underline">
                  how Braik is priced
                </Link>
                .
              </p>
            </ScrollReveal>
            <MarketingFaqAccordion entries={MARKETING_FAQ_ENTRIES} />
            <p className="text-center mt-10 text-sm text-[#6c757d]">
              <Link href="/faq" className="font-medium text-[#2563EB] hover:underline">
                View all FAQs
              </Link>{" "}
              ·{" "}
              <Link href="/pricing" className="font-medium text-[#2563EB] hover:underline">
                Pricing
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA — blue */}
      <section className={blueBand}>
        <div className="mx-auto max-w-6xl px-4">
          <div className="max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <div className="space-y-10">
                <h2 className="text-4xl md:text-5xl font-athletic font-bold text-white uppercase tracking-tight leading-tight">
                  See if Braik fits your program
                </h2>
                <div className="space-y-6 text-lg text-blue-50 leading-relaxed pt-4">
                  <p>
                    Braik was built to support coaches who are stretched thin, giving them the tools—and the help—they need to run their programs without sacrificing focus, organization, or time with their team.
                  </p>
                  <p>
                    If you're running a program where organization, communication, and accountability matter—but time and staffing are limited—Braik is built for you.
                  </p>
                </div>
                <div className="pt-8">
                  <HeroShatterCta
                    size="lg"
                    className="text-base px-10 py-6"
                    onAnimationStart={() => trackMarketingEvent("clicked_cta", { cta: "get_started_final" })}
                  />
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Request Demo — white (form + future optional imagery in section shell) */}
      <section id="request-demo" className={whiteBand}>
        <div className="relative z-10 mx-auto max-w-6xl px-4">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <div className="space-y-6">
                <h2 className="text-4xl md:text-5xl font-athletic font-bold text-gray-900 uppercase tracking-tight text-center">
                  Request a demo
                </h2>
                <p className="text-center text-gray-700 text-lg">
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
