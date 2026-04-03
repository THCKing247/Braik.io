"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  marketingSectionShell,
  SectionHeading,
  MarketingCard,
  BulletList,
} from "@/components/marketing/marketing-layout"
import { MarketingFaq, type MarketingFaqItem } from "@/components/marketing/marketing-faq"
import { getPublicJoinHref } from "@/lib/marketing/join-cta"
import { isWaitlistMode } from "@/lib/config/waitlist-mode"
import { trackMarketingEvent } from "@/lib/utils/analytics-client"

const shell = marketingSectionShell

const WHY_BRAIK_FAQ_ITEMS: MarketingFaqItem[] = [
  {
    q: "Who is Braik built for?",
    a: "Braik is built for football programs—especially high schools and growing athletic departments—that want one connected system for staff, players, and families without juggling a pile of separate apps.",
  },
  {
    q: "Can Braik support both varsity and JV?",
    a: "Yes. Varsity and JV can live under one program with clear roles: varsity leadership keeps program-level visibility while JV coaches run their own team day to day.",
  },
  {
    q: "Does Braik replace multiple tools?",
    a: "Braik is designed to bring core program operations together—communication, scheduling, rosters, documents, payments, and more—so your staff spends less time switching systems and more time coaching.",
  },
  {
    q: "Is Braik built for smaller coaching staffs?",
    a: "Yes. Fewer people wearing more hats is the norm. Braik reduces admin overhead and keeps workflows straightforward so small staffs are not buried in software upkeep.",
  },
  {
    q: "Can programs grow into Braik over time?",
    a: "Many teams start focused and add teams, depth, or features as needs change. The platform is built to scale with your program instead of forcing you into a rigid bundle on day one.",
  },
]

export function WhyBraikMarketingSections() {
  const joinHref = getPublicJoinHref()
  const primaryCtaLabel = isWaitlistMode() ? "Join the waitlist" : "Request access"

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#F8FAFC] via-white to-white pt-16 pb-10 md:pt-24 md:pb-14">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#3B82F6]/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#60A5FA]/10 blur-3xl" />
        </div>
        <div className={`${shell} text-center max-w-3xl`}>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-6">
            Why Braik
          </h1>
          <p className="text-lg md:text-xl text-[#212529]/85 leading-relaxed">
            Braik gives football programs one connected system for communication, scheduling, rosters, playbooks, video,
            and AI-powered support.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 border-y border-slate-200/80 py-6 text-sm md:text-base font-medium text-[#334155]">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" aria-hidden />
              Fewer disconnected tools
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" aria-hidden />
              Less admin overhead
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" aria-hidden />
              Built for real programs
            </span>
          </div>
        </div>
      </section>

      {/* The problem */}
      <section id="problem" className="scroll-mt-24 py-14 md:py-20 bg-white">
        <div className={shell}>
          <SectionHeading
            title="The problem with disconnected tools"
            description="Most programs are forced to piece together multiple tools for messaging, scheduling, payments, documents, and film. That creates unnecessary cost, confusion, and extra work."
          />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 max-w-7xl mx-auto">
            {[
              {
                title: "Rising costs",
                body: "Multiple subscriptions and overlapping tools add up—often without a single source of truth for your program.",
              },
              {
                title: "Fragmented communication",
                body: "When messages and updates live in different places, staff, players, and families get mixed signals.",
              },
              {
                title: "Duplicated work",
                body: "The same data gets entered again and again across apps, burning time coaches do not have.",
              },
              {
                title: "Parent/player confusion",
                body: "Families should not need a map to figure out where schedules, fees, and announcements actually live.",
              },
              {
                title: "Too many logins",
                body: "Every extra system is another password, another link, and another place something falls through the cracks.",
              },
              {
                title: "More admin stress",
                body: "Coaches end up managing software instead of running the program—and small staffs feel it first.",
              },
            ].map((card) => (
              <MarketingCard key={card.title} title={card.title}>
                <p>{card.body}</p>
              </MarketingCard>
            ))}
          </div>
        </div>
      </section>

      {/* What Braik does differently */}
      <section id="difference" className="scroll-mt-24 py-14 md:py-20 bg-gradient-to-b from-[#F8FAFC]/80 to-white">
        <div className={shell}>
          <SectionHeading
            title="What Braik does differently"
            description="Braik brings the moving parts of your program into one platform so your staff can spend less time managing software and more time coaching."
          />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 max-w-7xl mx-auto">
            <MarketingCard title="Scheduling & calendars">
              <p>Keep practices, games, and key dates organized in one place your program can actually rely on.</p>
            </MarketingCard>
            <MarketingCard title="Team communication">
              <p>Announcements, threads, and role-aware messaging that match how football programs are structured.</p>
            </MarketingCard>
            <MarketingCard title="Payments & dues">
              <p>Collect and track payments with less back-and-forth—without sending families to yet another portal.</p>
            </MarketingCard>
            <MarketingCard title="Documents & resources">
              <p>Centralize forms, policies, and team resources so players and parents know where to look.</p>
            </MarketingCard>
            <MarketingCard title="Role-based access">
              <p>Staff, players, and parents see what they need—without exposing the wrong things to the wrong people.</p>
            </MarketingCard>
            <MarketingCard title="AI-assisted support">
              <p>Reduce routine workload with AI that fits into real coaching workflows—not generic chat noise.</p>
            </MarketingCard>
          </div>
        </div>
      </section>

      {/* Built for real programs */}
      <section id="constraints" className="scroll-mt-24 py-14 md:py-20 bg-white">
        <div className={shell}>
          <SectionHeading
            title="Built for real program constraints"
            description="Braik was designed for the reality of high school football: limited staff, tight budgets, and high expectations—all at once."
          />
          <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
            <MarketingCard title="Limited staff">
              <p>Small coaching rooms should not mean endless software chores. Braik keeps day-to-day operations manageable.</p>
            </MarketingCard>
            <MarketingCard title="Tight budgets">
              <p>Programs need tools that stay practical. Braik is structured to stay accessible for real teams—not just ideal scenarios.</p>
            </MarketingCard>
            <MarketingCard title="High expectations">
              <p>Families and admins still expect professionalism and clarity. Braik helps you deliver that without a bloated toolchain.</p>
            </MarketingCard>
          </div>
          <p className="max-w-3xl mx-auto mt-10 md:mt-12 text-center text-base md:text-lg text-[#212529]/85 leading-relaxed">
            Braik is designed to stay practical, accessible, and scalable for high school programs and growing athletic departments.
          </p>
        </div>
      </section>

      {/* Varsity + JV */}
      <section id="varsity-jv" className="scroll-mt-24 py-14 md:py-20 bg-gradient-to-b from-[#F8FAFC]/80 to-white">
        <div className={shell}>
          <SectionHeading
            title="Built for full programs, not just one roster"
            description="Most programs don’t operate as a single team. Braik supports varsity and JV under one program while keeping team responsibilities clear."
          />
          <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
            <MarketingCard title="Varsity Head Coach">
              <BulletList
                items={[
                  "Oversees the full program",
                  "Creates and configures JV teams",
                  "Maintains program-level visibility",
                ]}
              />
            </MarketingCard>
            <MarketingCard title="JV Head Coach">
              <BulletList
                items={[
                  "Manages their own team",
                  "Controls schedule, communication, and roster",
                  "No access to varsity-only admin controls",
                ]}
              />
            </MarketingCard>
          </div>
          <p className="max-w-2xl mx-auto mt-10 text-center text-base font-medium text-[#212529]/90">
            Unified when it should be. Separate where it matters.
          </p>
        </div>
      </section>

      {/* Why teams choose */}
      <section id="why-teams" className="scroll-mt-24 py-14 md:py-20 bg-white">
        <div className={shell}>
          <div className="max-w-3xl mx-auto">
            <SectionHeading
              title="Why teams choose Braik"
              description="Braik helps programs simplify operations without sacrificing structure or control."
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
                "Scheduling",
                "Documents and resources",
                "AI support",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 min-w-0">
                  <span className="text-[#3B82F6] font-bold shrink-0 leading-none" aria-hidden>
                    ✓
                  </span>
                  <span className="text-[#212529]">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="why-braik-faq" className="scroll-mt-24 py-14 md:py-20 bg-gradient-to-b from-[#F8FAFC]/80 to-white">
        <div className={shell}>
          <MarketingFaq
            title="Frequently asked questions"
            subtitle="Straight answers about who Braik is for and how programs use it."
            items={WHY_BRAIK_FAQ_ITEMS}
          />
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-16 md:py-24 bg-[#0F172A] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden>
          <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-[#3B82F6]/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[#60A5FA]/15 blur-3xl" />
        </div>
        <div className={`${shell} max-w-3xl text-center relative z-10`}>
          <h2 className="text-3xl md:text-4xl font-athletic font-bold text-white uppercase tracking-tight mb-4">
            See how Braik fits your program
          </h2>
          <p className="text-lg text-slate-300 leading-relaxed mb-10">
            If you want a simpler way to manage communication, scheduling, rosters, and staff workflows, Braik can help.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="bg-[#3B82F6] hover:bg-[#2563EB] text-white font-athletic uppercase tracking-wide min-h-[52px] px-8 shadow-lg shadow-[#3B82F6]/25"
            >
              <Link
                href={joinHref}
                onClick={() => trackMarketingEvent("clicked_cta", { cta: "why_braik_join_waitlist" })}
              >
                {primaryCtaLabel}
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
                onClick={() => trackMarketingEvent("clicked_cta", { cta: "why_braik_book_demo" })}
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
