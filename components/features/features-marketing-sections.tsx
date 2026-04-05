"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  marketingSectionShell,
  SectionHeading,
  MarketingCard,
} from "@/components/marketing/marketing-layout"
import { MarketingFinalCta } from "@/components/marketing/marketing-final-cta"
import { getPublicJoinHref } from "@/lib/marketing/join-cta"
import { isWaitlistMode } from "@/lib/config/waitlist-mode"
import { trackMarketingEvent } from "@/lib/utils/analytics-client"

const shell = marketingSectionShell

type FeatureItem = {
  title: string
  description: string
  emoji: string
}

type FeatureGroup = {
  id: string
  title: string
  description: string
  items: FeatureItem[]
  /** Alternate section background */
  variant: "white" | "gradient"
}

const GROUPS: FeatureGroup[] = [
  {
    id: "team-operations",
    title: "Team operations",
    description:
      "Run rosters, calendars, permissions, and program settings from one place—so your staff spends less time hunting for information.",
    variant: "white",
    items: [
      {
        emoji: "👥",
        title: "Roster Management",
        description:
          "Track players, positions, and status. Import via CSV, manage season rollovers, and filter by position groups.",
      },
      {
        emoji: "📅",
        title: "Schedule & Calendar",
        description:
          "Calendar for practices, games, and meetings. Players RSVP availability. Color-coded event types with custom settings.",
      },
      {
        emoji: "⚙️",
        title: "Team Settings",
        description:
          "Customize team colors, logos, and branding. Manage calendar settings and assistant coach permissions.",
      },
      {
        emoji: "🔐",
        title: "Role-Based Access",
        description:
          "Head coaches, assistants, players, and parents see only what they need. Secure permissions keep data organized.",
      },
    ],
  },
  {
    id: "communication-admin",
    title: "Communication & admin",
    description:
      "Keep announcements, documents, invites, and AI-assisted workflows aligned with how your program actually communicates.",
    variant: "gradient",
    items: [
      {
        emoji: "📢",
        title: "Announcements",
        description:
          "Targeted messaging to coaches, players, or parents. Role-based visibility ensures the right people see the right updates.",
      },
      {
        emoji: "✉️",
        title: "Team Invites",
        description:
          "Invite coaches, players, and parents with role-based access. Bulk invite support for faster onboarding.",
      },
      {
        emoji: "📄",
        title: "Document Hub",
        description:
          "Upload playbooks, waivers, and policies. Role-based visibility with acknowledgement tracking for important documents.",
      },
      {
        emoji: "🤖",
        title: "AI Assistant",
        description:
          "Draft messages, summarize content, and flag unpaid dues. Your operations assistant that saves time on routine tasks.",
      },
    ],
  },
  {
    id: "payments-logistics",
    title: "Payments & logistics",
    description:
      "Collect dues, track gear, and stay on top of money and equipment without another spreadsheet or disconnected payment app.",
    variant: "white",
    items: [
      {
        emoji: "💳",
        title: "Digital Dues",
        description:
          "Season-based pricing with Stripe integration. Parents pay digitally. Track payment status with detailed exports.",
      },
      {
        emoji: "💰",
        title: "Coach-Collected Payments",
        description:
          "Track custom fees for gear, camps, and fundraisers. Separate from season dues with detailed transaction history.",
      },
      {
        emoji: "🎒",
        title: "Equipment Inventory",
        description:
          "Track team equipment, assign items to players, and monitor condition. Know what you have and where it is.",
      },
    ],
  },
]

function FeatureCard({ item }: { item: FeatureItem }) {
  return (
    <MarketingCard title={`${item.emoji} ${item.title}`}>
      <p>{item.description}</p>
    </MarketingCard>
  )
}

export function FeaturesMarketingSections() {
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
            Platform features
          </h1>
          <p className="text-lg md:text-xl text-[#212529]/85 leading-relaxed">
            Everything your football program needs to run day-to-day operations—rosters, schedules, communication,
            documents, payments, and AI support—in one connected system.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 border-y border-slate-200/80 py-6 text-sm md:text-base font-medium text-[#334155]">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" aria-hidden />
              Built for varsity &amp; JV
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" aria-hidden />
              Role-aware workflows
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" aria-hidden />
              Less tool-switching
            </span>
          </div>
          <div className="mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="bg-[#3B82F6] hover:bg-[#2563EB] text-white font-athletic uppercase tracking-wide min-h-[52px] px-8 shadow-lg shadow-[#3B82F6]/25"
            >
              <Link
                href={joinHref}
                onClick={() => trackMarketingEvent("clicked_cta", { cta: "features_hero_join" })}
              >
                {primaryCtaLabel}
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-2 border-slate-300 bg-white text-[#212529] hover:bg-slate-50 font-athletic uppercase tracking-wide min-h-[52px] px-8"
            >
              <Link
                href="/#request-demo"
                onClick={() => trackMarketingEvent("clicked_cta", { cta: "features_hero_book_demo" })}
              >
                Book a Demo
              </Link>
            </Button>
          </div>
          <p className="mt-8 text-sm text-[#64748B]">
            <Link href="/pricing" className="font-medium text-[#2563EB] hover:underline" onClick={() => trackMarketingEvent("clicked_cta", { cta: "features_hero_pricing" })}>
              View pricing
            </Link>
            <span className="mx-2 text-slate-500" aria-hidden>
              ·
            </span>
            <Link href="/why-braik" className="font-medium text-[#2563EB] hover:underline" onClick={() => trackMarketingEvent("clicked_cta", { cta: "features_hero_why_braik" })}>
              Why Braik
            </Link>
          </p>
        </div>
      </section>

      {GROUPS.map((group) => (
        <section
          key={group.id}
          id={group.id}
          className={`scroll-mt-24 py-14 md:py-20 ${
            group.variant === "gradient" ? "bg-gradient-to-b from-[#F8FAFC]/80 to-white" : "bg-white"
          }`}
        >
          <div className={shell}>
            <SectionHeading title={group.title} description={group.description} />
            <div
              className={`grid gap-6 max-w-7xl mx-auto ${
                group.items.length >= 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-3"
              }`}
            >
              {group.items.map((item) => (
                <FeatureCard key={item.title} item={item} />
              ))}
            </div>
          </div>
        </section>
      ))}

      <MarketingFinalCta
        title="Ready to see Braik in your program?"
        description="Join the waitlist or book a demo—we’ll walk through features, structure, and pricing for your roster and teams."
        primaryHref={joinHref}
        primaryLabel={primaryCtaLabel}
        primaryAnalyticsCta="features_footer_join"
        secondaryAnalyticsCta="features_footer_book_demo"
      />
    </>
  )
}
