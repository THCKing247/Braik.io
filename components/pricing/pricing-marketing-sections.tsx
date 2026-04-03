"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { PricingFaq } from "@/components/pricing/pricing-faq"
import { getPublicJoinHref } from "@/lib/marketing/join-cta"
import { isWaitlistMode } from "@/lib/config/waitlist-mode"
import { trackMarketingEvent } from "@/lib/utils/analytics-client"

const sectionShell = "container mx-auto px-4 relative z-10"

function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  className?: string
}) {
  return (
    <div className={cn("max-w-3xl mb-10 md:mb-12", className)}>
      {eyebrow ? (
        <p className="text-sm font-semibold uppercase tracking-wider text-[#3B82F6] mb-2">{eyebrow}</p>
      ) : null}
      <h2 className="text-2xl md:text-3xl lg:text-4xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-3">
        {title}
      </h2>
      {description ? <p className="text-base md:text-lg text-[#212529]/80 leading-relaxed">{description}</p> : null}
    </div>
  )
}

function PriceCard({
  title,
  price,
  children,
  className,
  badge,
  footerNote,
}: {
  title: string
  price: string
  children: ReactNode
  className?: string
  badge?: string
  footerNote?: string
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-slate-200/90 bg-white p-6 md:p-8 shadow-sm transition-all duration-200",
        "hover:shadow-md hover:border-[#3B82F6]/30",
        badge && "pt-8 md:pt-9",
        className
      )}
    >
      {badge ? (
        <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-[#3B82F6] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-sm">
          {badge}
        </span>
      ) : null}
      <h3 className="text-lg md:text-xl font-athletic font-semibold text-[#212529] uppercase tracking-wide mb-2 pr-2">
        {title}
      </h3>
      <p className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-6">{price}</p>
      <div className="text-[#212529]/85 space-y-4 text-sm md:text-base leading-relaxed">{children}</div>
      {footerNote ? <p className="mt-4 text-xs text-[#64748B] leading-relaxed">{footerNote}</p> : null}
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="text-[#3B82F6] font-bold shrink-0" aria-hidden>
            ✓
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function PricingMarketingSections() {
  const requestHref = getPublicJoinHref()
  const requestLabel = isWaitlistMode() ? "Join the waitlist" : "Request Pricing"

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#F8FAFC] via-white to-white pt-16 pb-10 md:pt-24 md:pb-14">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#3B82F6]/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#60A5FA]/10 blur-3xl" />
        </div>
        <div className={`${sectionShell} text-center max-w-3xl`}>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-6">
            Simple pricing for modern football programs
          </h1>
          <p className="text-lg md:text-xl text-[#212529]/85 leading-relaxed">
            Braik gives your team one system for roster management, playbooks, communication, and AI-powered coaching
            tools — with optional video and game clip features available as an add-on.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 border-y border-slate-200/80 py-6 text-sm md:text-base font-medium text-[#334155]">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" aria-hidden />
              No hidden fees
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" aria-hidden />
              Clear pricing
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" aria-hidden />
              Built to scale with your program
            </span>
          </div>
        </div>
      </section>

      {/* Core platform */}
      <section id="core-platform" className="scroll-mt-24 py-14 md:py-20 bg-white">
        <div className={sectionShell}>
          <SectionHeading
            title="Core platform pricing"
            description="Everything you need to run your team in one place."
          />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 max-w-7xl mx-auto">
            <PriceCard title="Base platform" price="$250 / year per team">
              <BulletList
                items={["Core platform access", "Playbooks", "Messaging", "Roster system", "AI Coach B"]}
              />
            </PriceCard>
            <PriceCard title="Roster licensing" price="$10 per athlete / year">
              <p className="font-medium text-[#212529]">Example</p>
              <p>40 players = $400</p>
            </PriceCard>
            <PriceCard title="Assistant coaches" price="$25 per additional coach">
              <p>
                Low-cost coach access makes it easy to add your staff without overpaying for seats.
              </p>
            </PriceCard>
            <PriceCard title="Additional teams" price="$100 base + $10 per athlete">
              <p className="font-medium text-[#212529] mb-2">Best for</p>
              <BulletList items={["JV teams", "Freshman teams", "Expanding programs"]} />
              <div className="mt-4 pt-4 border-t border-slate-100 text-sm">
                <p className="font-medium text-[#212529] mb-1">Example</p>
                <p>JV team fee = $100</p>
                <p>35 players = $350</p>
                <p className="font-semibold text-[#0F172A] mt-2">Total JV team = $450</p>
              </div>
            </PriceCard>
          </div>
        </div>
      </section>

      {/* Onboarding */}
      <section id="onboarding" className="scroll-mt-24 py-14 md:py-20 bg-gradient-to-b from-[#F8FAFC]/80 to-white">
        <div className={sectionShell}>
          <SectionHeading
            title="One-time onboarding"
            description="We do more than hand you software — we help get your program set up the right way."
          />
          <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
            <PriceCard title="Small team setup" price="$150–$250 one-time">
              <p className="font-medium text-[#212529] mb-2">Best for</p>
              <BulletList items={["Single varsity team", "Smaller programs"]} />
              <p className="font-medium text-[#212529] mt-4 mb-2">Includes</p>
              <BulletList items={["Account setup", "Roster import", "Basic onboarding", "Quick walkthrough"]} />
            </PriceCard>
            <PriceCard title="School / program setup" price="$300–$500 one-time">
              <p className="font-medium text-[#212529] mb-2">Best for</p>
              <BulletList items={["Varsity + JV", "Multi-team programs"]} />
              <p className="font-medium text-[#212529] mt-4 mb-2">Includes</p>
              <BulletList
                items={[
                  "Multi-team setup",
                  "Live coach onboarding session",
                  "Data migration",
                  "Initial configuration",
                ]}
              />
            </PriceCard>
            <PriceCard title="Enterprise onboarding" price="$500–$1,500+ one-time">
              <p className="font-medium text-[#212529] mb-2">Best for</p>
              <BulletList items={["Athletic departments", "Multi-sport programs", "Multi-school rollouts"]} />
              <p className="font-medium text-[#212529] mt-4 mb-2">Includes</p>
              <BulletList
                items={[
                  "Full platform rollout",
                  "Admin / Athletic Director training",
                  "Priority onboarding",
                  "Custom setup and configuration",
                ]}
              />
            </PriceCard>
          </div>
        </div>
      </section>

      {/* Video add-ons */}
      <section id="video-add-ons" className="scroll-mt-24 py-14 md:py-20 bg-white">
        <div className={sectionShell}>
          <SectionHeading
            title="Video & game clip add-on"
            description="Add film, clips, and video review to the same platform you already use to run your program."
          />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 max-w-7xl mx-auto">
            <PriceCard title="Starter video" price="$150 / year per team">
              <BulletList
                items={[
                  "Up to 100 GB storage",
                  "Game film upload and playback",
                  "Basic clip creation",
                  "Share clips with players",
                ]}
              />
              <p className="font-medium text-[#212529] mt-4 mb-2">Best for</p>
              <BulletList items={["Small teams", "Light video usage"]} />
            </PriceCard>
            <PriceCard
              title="Pro video"
              price="$300 / year per team"
              badge="Most Popular"
              className="ring-2 ring-[#3B82F6]/35 shadow-md"
              footerNote="Recommended for most teams"
            >
              <BulletList
                items={[
                  "Up to 500 GB storage",
                  "Advanced clip creation tools",
                  "Tagging by plays, players, and situations",
                  "Team-wide video sharing",
                  "Mobile-friendly viewing",
                ]}
              />
              <p className="font-medium text-[#212529] mt-4 mb-2">Best for</p>
              <BulletList items={["Varsity teams", "Weekly film breakdown"]} />
            </PriceCard>
            <PriceCard title="Elite video" price="$600 / year per team">
              <BulletList
                items={[
                  "Up to 2 TB storage",
                  "Unlimited clips",
                  "Advanced tagging and organization",
                  "AI-assisted clip suggestions",
                  "Priority video processing",
                ]}
              />
              <p className="font-medium text-[#212529] mt-4 mb-2">Best for</p>
              <BulletList items={["High-volume programs", "Serious film and analysis workflows"]} />
            </PriceCard>
            <PriceCard title="Enterprise video" price="Custom pricing">
              <BulletList
                items={[
                  "Shared storage across all teams",
                  "Central video library",
                  "Cross-team visibility",
                  "Bulk upload and management tools",
                  "Priority support",
                ]}
              />
              <p className="font-medium text-[#212529] mt-4 mb-2">Best for</p>
              <BulletList items={["Athletic departments", "Multi-team programs"]} />
            </PriceCard>
          </div>
          <p className="max-w-3xl mx-auto mt-8 text-center text-sm text-[#64748B] leading-relaxed">
            Overage pricing: $0.25 per GB over limit annually, or upgrade to the next tier.
          </p>
        </div>
      </section>

      {/* Example pricing */}
      <section id="example-pricing" className="scroll-mt-24 py-14 md:py-20 bg-gradient-to-b from-white via-[#F8FAFC]/50 to-white">
        <div className={sectionShell}>
          <SectionHeading
            title="Example pricing"
            description="Here’s what a few common setups can look like."
          />
          <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
            {[
              {
                title: "Varsity team",
                lines: ["Base platform: $250", "40 athletes: $400", "Onboarding: $300–$500"],
                total: "Estimated total: $950–$1,150 first year",
              },
              {
                title: "Varsity + JV",
                lines: [
                  "Varsity base: $250",
                  "Varsity athletes: $400",
                  "JV team base: $100",
                  "JV athletes: $350",
                  "Onboarding: $300–$500",
                ],
                total: "Estimated total: $1,400–$1,600 first year",
              },
              {
                title: "Varsity team + Pro video",
                lines: [
                  "Base platform: $250",
                  "40 athletes: $400",
                  "Pro video: $300",
                  "Onboarding: $300–$500",
                ],
                total: "Estimated total: $1,250–$1,450 first year",
              },
            ].map((ex) => (
              <div
                key={ex.title}
                className="rounded-2xl border border-slate-200/90 bg-white p-6 md:p-8 shadow-sm transition-all duration-200 hover:shadow-md hover:border-[#3B82F6]/25"
              >
                <h3 className="text-lg font-athletic font-semibold text-[#212529] uppercase tracking-wide mb-4">
                  {ex.title}
                </h3>
                <ul className="space-y-2 text-sm md:text-base text-[#212529]/85 mb-6">
                  {ex.lines.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span className="text-slate-300 shrink-0">—</span>
                      {line}
                    </li>
                  ))}
                </ul>
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-1">Total</p>
                  <p className="text-lg font-bold text-[#0F172A]">{ex.total}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Discounts + Why Braik */}
      <section id="discounts" className="scroll-mt-24 py-14 md:py-20 bg-white">
        <div className={sectionShell}>
          <div className="max-w-5xl mx-auto grid gap-10 lg:grid-cols-2 lg:gap-14 items-start">
            <div className="rounded-2xl border border-slate-200/90 bg-[#F8FAFC]/50 p-8 md:p-10 shadow-sm">
              <h2 className="text-xl md:text-2xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-6">
                Available discounts
              </h2>
              <ul className="space-y-3 text-[#212529]/90">
                <li className="flex gap-2">
                  <span className="text-[#3B82F6] font-bold">✓</span>
                  Referral discount: -$50
                </li>
                <li className="flex gap-2">
                  <span className="text-[#3B82F6] font-bold">✓</span>
                  Multi-team discount: -$50
                </li>
                <li className="flex gap-2">
                  <span className="text-[#3B82F6] font-bold">✓</span>
                  Custom pricing available for larger programs
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200/90 bg-white p-8 md:p-10 shadow-sm">
              <h2 className="text-xl md:text-2xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-4">
                Why Braik
              </h2>
              <p className="text-[#212529]/85 leading-relaxed mb-6">
                Hudl charges for video. Braik gives you video plus your entire team operating system.
              </p>
              <ul className="space-y-2 mb-6">
                {["Rosters", "Playbooks", "Team communication", "AI coaching support", "Video and game clips"].map(
                  (item) => (
                    <li key={item} className="flex gap-2 text-[#212529]">
                      <span className="text-[#3B82F6] font-bold shrink-0">✓</span>
                      {item}
                    </li>
                  )
                )}
              </ul>
              <p className="text-sm text-[#64748B] leading-relaxed border-t border-slate-100 pt-6">
                Instead of paying for multiple disconnected tools, Braik brings everything into one place.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="pricing-faq" className="scroll-mt-24 py-14 md:py-20 bg-gradient-to-b from-[#F8FAFC]/80 to-white">
        <div className={sectionShell}>
          <PricingFaq />
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-16 md:py-24 bg-[#0F172A] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden>
          <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-[#3B82F6]/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[#60A5FA]/15 blur-3xl" />
        </div>
        <div className={`${sectionShell} max-w-3xl text-center relative z-10`}>
          <h2 className="text-3xl md:text-4xl font-athletic font-bold text-white uppercase tracking-tight mb-4">
            Ready to simplify your program?
          </h2>
          <p className="text-lg text-slate-300 leading-relaxed mb-10">
            Get a custom Braik quote based on your roster size, team structure, and video needs.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="bg-[#3B82F6] hover:bg-[#2563EB] text-white font-athletic uppercase tracking-wide min-h-[52px] px-8 shadow-lg shadow-[#3B82F6]/25"
            >
              <Link
                href={requestHref}
                onClick={() => trackMarketingEvent("clicked_cta", { cta: "pricing_request_pricing" })}
              >
                {requestLabel}
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-2 border-white/30 bg-white/5 text-white hover:bg-white/10 hover:border-white/50 font-athletic uppercase tracking-wide min-h-[52px] px-8"
            >
              <Link
                href="/#request-demo"
                onClick={() => trackMarketingEvent("clicked_cta", { cta: "pricing_book_demo" })}
              >
                Book a Demo
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
