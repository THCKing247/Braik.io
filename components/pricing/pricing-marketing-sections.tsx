"use client"

import { FAQLinkCTA } from "@/components/marketing/faq-link-cta"
import {
  marketingSectionShell as sectionShell,
  SectionHeading,
  PriceCard,
  BulletList,
} from "@/components/marketing/marketing-layout"
import { MarketingFinalCta } from "@/components/marketing/marketing-final-cta"
import { getPublicJoinHref } from "@/lib/marketing/join-cta"
import { isWaitlistMode } from "@/lib/config/waitlist-mode"

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

      {/* Why Braik */}
      <section id="why-braik" className="scroll-mt-24 py-14 md:py-20 bg-gradient-to-b from-[#F8FAFC]/80 to-white">
        <div className={sectionShell}>
          <div className="max-w-3xl mx-auto">
            <SectionHeading
              title="Why Braik"
              description="Braik brings everything your program needs into one platform — from roster management and communication to playbooks, video, and AI-powered coaching tools."
              className="text-center mx-auto"
            />
            <ul
              className="mt-2 md:mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 max-w-2xl mx-auto list-none p-0 text-left"
              role="list"
            >
              {[
                "Roster management",
                "Playbooks",
                "Team communication",
                "AI coaching support",
                "Video and game clips",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 min-w-0">
                  <span className="text-[#3B82F6] font-bold shrink-0 leading-none" aria-hidden>
                    ✓
                  </span>
                  <span className="text-[#212529]">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-10 text-center text-base md:text-lg text-[#212529]/90 font-medium leading-relaxed">
              Everything your team needs, all in one place.
            </p>
          </div>
        </div>
      </section>

      <FAQLinkCTA id="pricing-faq" imagePosition="right" />

      <MarketingFinalCta
        title="Ready to simplify your program?"
        description="Get a custom Braik quote based on your roster size, team structure, and video needs."
        primaryHref={requestHref}
        primaryLabel={requestLabel}
        primaryAnalyticsCta="pricing_request_pricing"
        secondaryAnalyticsCta="pricing_book_demo"
      />
    </>
  )
}
