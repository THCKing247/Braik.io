import Link from "next/link"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { MarketingCard } from "@/components/marketing/marketing-layout"
import {
  MarketingHeroShell,
  MarketingPageSection,
  MarketingShell,
  marketingBodyClass,
  marketingMutedClass,
  marketingSectionShell,
} from "@/components/marketing/marketing-page"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <MarketingHeroShell>
        <div className={`${marketingSectionShell} text-center max-w-3xl mx-auto`}>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-6">
            About Braik
          </h1>
          <p className={`${marketingBodyClass} text-[#212529]/85`}>
            The team operating system for football programs that need structure without another pile of disconnected apps.
          </p>
        </div>
      </MarketingHeroShell>

      <MarketingPageSection variant="white">
        <MarketingShell>
          <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
            <MarketingCard title="What Braik is">
              <div className="space-y-4">
                <p>
                  Braik is a single place for rosters, schedules, messaging, documents, collections, and football-specific tools like
                  playbooks—so head coaches can run the program instead of chasing fifteen different logins.
                </p>
                <p>
                  <span className="font-semibold text-[#212529]">We ship for football first.</span> Workflows, language, and permissions
                  mirror how varsity staffs, position coaches, players, and families actually interact. Other sports may come later; today
                  we focus on doing football operations exceptionally well.
                </p>
              </div>
            </MarketingCard>

            <MarketingCard title="How Braik helps">
              <ul className="space-y-3 list-none pl-0">
                <li className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B82F6]" aria-hidden />
                  <span>
                    <strong className="text-[#212529]">Less admin noise</strong> — one roster, one schedule, one thread of truth for
                    parents and players.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B82F6]" aria-hidden />
                  <span>
                    <strong className="text-[#212529]">Coach B</strong> — AI that reads your program context and helps with
                    communication and prep, always subordinate to staff judgment (
                    <Link href="/ai-transparency" className="text-[#2563EB] font-medium hover:underline">
                      how we use AI
                    </Link>
                    ).
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B82F6]" aria-hidden />
                  <span>
                    <strong className="text-[#212529]">Program-shaped</strong> — varsity, JV, and freshman can live under one program
                    without duplicating subscriptions or splitting your staff across tools.
                  </span>
                </li>
              </ul>
            </MarketingCard>

            <MarketingCard title="Who it&apos;s for">
              <div className="space-y-4">
                <p>
                  High school and serious youth programs where time is scarce, expectations are high, and the head coach is still the
                  default chief operating officer. If that sounds like your building, Braik is built for you.
                </p>
                <p className={marketingMutedClass}>
                  Questions about cost? Start with{" "}
                  <Link href="/pricing#core-platform" className="text-[#2563EB] font-medium hover:underline">
                    pricing
                  </Link>{" "}
                  or the{" "}
                  <Link href="/faq" className="text-[#2563EB] font-medium hover:underline">
                    FAQ
                  </Link>
                  .
                </p>
              </div>
            </MarketingCard>
          </div>
        </MarketingShell>
      </MarketingPageSection>

      <SiteFooter />
    </div>
  )
}
