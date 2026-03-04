"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ScrollReveal } from "@/components/scroll-reveal"
import { SectionDivider } from "@/components/section-divider"
import { HeroShatterCta } from "@/components/hero-shatter-cta"
import { LeadCaptureForm } from "@/components/lead-capture-form"
import { trackMarketingEvent } from "@/lib/analytics-client"

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
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* Hero Identity Section */}
      <section className="relative min-h-[90vh] flex items-center bg-gradient-to-b from-[#F8FAFC] via-white to-white overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#3B82F6]/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#60A5FA]/10 blur-3xl" />
        </div>
        <div className="container relative mx-auto px-4 py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-12">
            <ScrollReveal>
              <div className="space-y-7">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-athletic font-bold text-[#212529] uppercase tracking-tight leading-[1.08]">
                  Braik the busywork.
                  <br />
                  <span className="text-[#3B82F6]">Run the team.</span>
                </h1>
                <p className="text-lg md:text-xl text-[#495057] font-medium max-w-2xl mx-auto leading-relaxed">
                  Your AI Operations Coach for Every Season.
                  <br />
                  <span className="font-semibold text-[#495057]">Braik the Chaos.</span>
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-2">
                  {heroValuePills.map((pill) => (
                    <span
                      key={pill}
                      className="inline-flex items-center rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-4 py-2 text-sm font-medium text-[#1E3A8A]"
                    >
                      {pill}
                    </span>
                  ))}
                </div>
              </div>
            </ScrollReveal>
            
            <ScrollReveal delay={100}>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                <HeroShatterCta
                  size="lg"
                  className="text-base px-10 py-6 w-full sm:w-auto"
                  onAnimationStart={() => trackMarketingEvent("clicked_cta", { cta: "get_started_hero" })}
                />
                <Link
                  href="/pricing"
                  onClick={() => trackMarketingEvent("clicked_cta", { cta: "view_pricing_hero" })}
                >
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-base px-10 py-6 w-full sm:w-auto border-[#3B82F6] text-[#1D4ED8] hover:bg-[#EFF6FF]"
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
                    className="text-base px-10 py-6 w-full sm:w-auto"
                  >
                    Request demo
                  </Button>
                </Link>
              </div>
            </ScrollReveal>
            
            {/* Returning User Login - Visually De-emphasized */}
            <ScrollReveal delay={200}>
              <div className="pt-16 border-t border-[#E5E7EB]">
                <p className="text-sm text-[#6c757d] font-medium">
                  Returning to Braik?{" "}
                  <Link href="/login" className="text-[#3B82F6] hover:underline">
                    Sign in here
                  </Link>
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <SectionDivider variant="thick" className="opacity-20" />

      {/* Coach Reality Validation */}
      <section className="relative py-40 bg-[#1a1d21]">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <div className="space-y-8">
                <h2 className="text-4xl md:text-5xl font-athletic font-bold text-white uppercase tracking-tight text-center leading-tight">
                  Coaches today are expected to do far more than coach.
                </h2>
                <div className="space-y-6 text-lg text-[#E5E7EB] leading-relaxed pt-8">
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

      {/* Section Divider */}
      <SectionDivider variant="offset" className="opacity-15" />

      {/* Reframing Braik */}
      <section className="relative py-40 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
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
                  <h2 className="text-4xl md:text-5xl font-athletic font-bold text-[#212529] uppercase tracking-tight leading-tight">
                    One system. Less stress.
                  </h2>
                  <div className="space-y-6 text-lg text-[#495057] leading-relaxed pt-8">
                    <p className="text-xl font-medium text-[#212529]">
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
        </div>
      </section>

      {/* Section Divider */}
      <SectionDivider variant="asymmetric" className="opacity-15" />

      {/* Built for Real Program Constraints */}
      <section ref={pricingSectionRef} className="relative py-40 bg-[#F9FAFB]">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <div className="space-y-8">
                <h2 className="text-4xl md:text-5xl font-athletic font-bold text-[#212529] uppercase tracking-tight text-center leading-tight">
                  Built for real program constraints
                </h2>
                <div className="space-y-6 text-lg text-[#495057] leading-relaxed pt-8">
                  <p>
                    Braik was designed with a clear reality in mind: coaching staffs are limited, budgets are tight, and expectations remain high.
                  </p>
                  <p>
                    Rather than pushing premium pricing or locking teams into rigid plans, Braik is structured to stay accessible for real programs—especially at the high school level. The platform is built to grow with your program, not force you to overpay for features you don't need.
                  </p>
                  <p>
                    Braik is billed per season, aligned with team dues and seasonal planning. It's budgetable, intentional, and built for programs that need structure without complexity.
                  </p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <SectionDivider variant="thick" className="opacity-20" />

      {/* Varsity & JV Program Structure */}
      <section className="relative py-40 bg-[#1a1d21]">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <div className="space-y-8">
                <h2 className="text-4xl md:text-5xl font-athletic font-bold text-white uppercase tracking-tight text-center leading-tight">
                  Built for entire programs — Varsity and JV
                </h2>
                <div className="space-y-6 text-lg text-[#E5E7EB] leading-relaxed pt-8">
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

      {/* Section Divider */}
      <SectionDivider variant="offset" className="opacity-15" />

      {/* High-Level Capabilities */}
      <section className="relative py-40 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <ScrollReveal>
              <h2 className="text-4xl md:text-5xl font-athletic font-bold text-[#212529] uppercase tracking-tight text-center mb-20">
                Core operational areas
              </h2>
            </ScrollReveal>
            
            <div className="grid md:grid-cols-2 gap-8">
              <ScrollReveal delay={0} className="h-full">
                <div className="h-full p-10 rounded-[14px] relative overflow-hidden" style={{ backgroundColor: 'rgba(28, 28, 28, 0.9)', backdropFilter: 'blur(6px)', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: '#3B82F6' }}></div>
                  <h3 className="text-2xl font-athletic font-semibold mb-4 text-white uppercase tracking-wide">
                    Communication
                  </h3>
                  <p className="text-lg text-[#E5E7EB] leading-relaxed">
                    Targeted messaging and announcements that keep everyone informed without overwhelming anyone. The right people see the right information, automatically.
                  </p>
                </div>
              </ScrollReveal>
              
              <ScrollReveal delay={50} className="h-full">
                <div className="h-full p-10 rounded-[14px] relative overflow-hidden" style={{ backgroundColor: 'rgba(28, 28, 28, 0.9)', backdropFilter: 'blur(6px)', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: '#3B82F6' }}></div>
                  <h3 className="text-2xl font-athletic font-semibold mb-4 text-white uppercase tracking-wide">
                    Scheduling
                  </h3>
                  <p className="text-lg text-[#E5E7EB] leading-relaxed">
                    Calendar management with RSVPs and event coordination. Everyone sees what they need to see, when they need to see it.
                  </p>
                </div>
              </ScrollReveal>
              
              <ScrollReveal delay={100} className="h-full">
                <div className="h-full p-10 rounded-[14px] relative overflow-hidden" style={{ backgroundColor: 'rgba(28, 28, 28, 0.9)', backdropFilter: 'blur(6px)', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: '#3B82F6' }}></div>
                  <h3 className="text-2xl font-athletic font-semibold mb-4 text-white uppercase tracking-wide">
                    Payments
                  </h3>
                  <p className="text-lg text-[#E5E7EB] leading-relaxed">
                    Season-based dues collection and coach-collected payments with clear tracking and accountability. Know who's paid, who hasn't, and what's outstanding.
                  </p>
                </div>
              </ScrollReveal>
              
              <ScrollReveal delay={150} className="h-full">
                <div className="h-full p-10 rounded-[14px] relative overflow-hidden" style={{ backgroundColor: 'rgba(28, 28, 28, 0.9)', backdropFilter: 'blur(6px)', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: '#3B82F6' }}></div>
                  <h3 className="text-2xl font-athletic font-semibold mb-4 text-white uppercase tracking-wide">
                    Documents
                  </h3>
                  <p className="text-lg text-[#E5E7EB] leading-relaxed">
                    Centralized playbooks, installs, and program resources. Organized by unit and position, with acknowledgement tracking for important materials.
                  </p>
                </div>
              </ScrollReveal>
              
              <ScrollReveal delay={200} className="h-full">
                <div className="h-full p-10 rounded-[14px] relative overflow-hidden" style={{ backgroundColor: 'rgba(28, 28, 28, 0.9)', backdropFilter: 'blur(6px)', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: '#3B82F6' }}></div>
                  <h3 className="text-2xl font-athletic font-semibold mb-4 text-white uppercase tracking-wide">
                    Inventory
                  </h3>
                  <p className="text-lg text-[#E5E7EB] leading-relaxed">
                    Equipment tracking and assignment for team-issued gear. Know what you have, where it is, and who's responsible for it.
                  </p>
                </div>
              </ScrollReveal>
              
              <ScrollReveal delay={250} className="h-full">
                <div className="h-full p-10 rounded-[14px] relative overflow-hidden" style={{ backgroundColor: 'rgba(28, 28, 28, 0.9)', backdropFilter: 'blur(6px)', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
                  <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: '#3B82F6' }}></div>
                  <h3 className="text-2xl font-athletic font-semibold mb-4 text-white uppercase tracking-wide">
                    Roster Management
                  </h3>
                  <p className="text-lg text-[#E5E7EB] leading-relaxed">
                    Player tracking, position management, and depth charts. Everything organized the way your program actually operates.
                  </p>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <SectionDivider variant="asymmetric" className="opacity-15" />

      {/* Role-Based Value */}
      <section className="relative py-32 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <h2 className="text-4xl md:text-5xl font-athletic font-bold text-[#212529] uppercase tracking-tight text-center mb-14">
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
                  <div
                    className="h-full p-8 rounded-[14px] relative overflow-hidden"
                    style={{
                      backgroundColor: "rgba(28, 28, 28, 0.9)",
                      backdropFilter: "blur(6px)",
                      boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                    }}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3B82F6]" />
                    <h3 className="text-2xl font-athletic font-semibold mb-3 text-white uppercase tracking-wide">
                      {item.role}
                    </h3>
                    <p className="text-[#E5E7EB] leading-relaxed">{item.details}</p>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AI Operations Coach (Foundational) */}
      <section className="relative py-40 bg-[#F9FAFB]">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal>
              <div className="grid md:grid-cols-2 gap-12 items-center">
                {/* Content on the left */}
                <div className="space-y-8">
                  <h2 className="text-4xl md:text-5xl font-athletic font-bold text-[#212529] uppercase tracking-tight leading-tight">
                    AI Operations Coach is foundational
                  </h2>
                  <div className="space-y-6 text-lg text-[#495057] leading-relaxed pt-8">
                    <p>
                      Braik is built around an AI Operations Coach that helps run the day to day load of a program: drafting communication, surfacing issues, and executing structured operations.
                    </p>
                    <p>
                      Head Coach access is included by default with metered usage each season. If usage exceeds the included allotment, additional usage is billed so programs can scale without interruption.
                    </p>
                    <p className="text-[#6c757d] italic">
                      Assistant Coach AI access is tiered opt in under Head Coach control. The AI is not a side add on. It is a core operational layer designed to support coaching judgment, not replace it.
                    </p>
                  </div>
                </div>
                {/* Visual on the right (brand-safe placeholder) */}
                <div className="flex justify-center md:justify-end md:ml-8 w-full">
                  <div className="w-full max-w-md p-10 rounded-[14px] relative overflow-hidden" style={{ backgroundColor: 'rgba(28, 28, 28, 0.9)', backdropFilter: 'blur(6px)', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }}>
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: '#3B82F6' }}></div>
                    <p className="text-white text-2xl font-athletic font-semibold uppercase tracking-wide mb-3">
                      Operations Coach Workflows
                    </p>
                    <p className="text-[#E5E7EB] text-base leading-relaxed">
                      Head Coach default AI plus assistant tier controls, usage guardrails, and execution support built for real staff workflows.
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Section Divider */}
      <SectionDivider variant="thick" className="opacity-20" />

      {/* Final CTA */}
      <section className="relative py-40 bg-[#1a1d21]">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <div className="space-y-10">
                <h2 className="text-4xl md:text-5xl font-athletic font-bold text-white uppercase tracking-tight leading-tight">
                  See if Braik fits your program
                </h2>
                <div className="space-y-6 text-lg text-[#E5E7EB] leading-relaxed pt-4">
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

      {/* Request Demo */}
      <section id="request-demo" className="relative py-32 bg-[#111827]">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <ScrollReveal>
              <div className="space-y-6">
                <h2 className="text-4xl md:text-5xl font-athletic font-bold text-white uppercase tracking-tight text-center">
                  Request a demo
                </h2>
                <p className="text-center text-[#E5E7EB] text-lg">
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
  )
}
