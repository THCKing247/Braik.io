import Link from "next/link"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <section className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#F8FAFC] via-white to-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#3B82F6]/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#60A5FA]/10 blur-3xl" />
        </div>

        <div className="container mx-auto px-4 py-20 relative z-10">
          <h1 className="text-4xl md:text-5xl font-athletic font-bold text-center mb-4 text-[#212529] uppercase tracking-tight">
            About Braik
          </h1>
          <p className="text-center text-lg text-[#495057] max-w-2xl mx-auto mb-12">
            The team operating system for football programs that need structure without another pile of disconnected apps.
          </p>

          <div className="max-w-4xl mx-auto space-y-10">
            <div className="p-10 rounded-[14px] relative overflow-hidden border border-[#E8EAED] bg-gradient-to-br from-[#FAFAFA] to-[#F0F1F3] shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3B82F6]" />
              <h2 className="text-2xl font-athletic font-semibold mb-4 text-[#212529] uppercase tracking-wide">
                What Braik is
              </h2>
              <div className="space-y-4 text-lg text-[#495057] leading-relaxed">
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
            </div>

            <div className="p-10 rounded-[14px] relative overflow-hidden border border-[#E8EAED] bg-gradient-to-br from-[#FAFAFA] to-[#F0F1F3] shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3B82F6]" />
              <h2 className="text-2xl font-athletic font-semibold mb-4 text-[#212529] uppercase tracking-wide">
                How Braik helps
              </h2>
              <ul className="space-y-3 text-lg text-[#495057] leading-relaxed list-none pl-0">
                <li className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B82F6]" />
                  <span>
                    <strong className="text-[#212529]">Less admin noise</strong> — one roster, one schedule, one thread of truth for
                    parents and players.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B82F6]" />
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
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B82F6]" />
                  <span>
                    <strong className="text-[#212529]">Program-shaped</strong> — varsity, JV, and freshman can live under one program
                    without duplicating subscriptions or splitting your staff across tools.
                  </span>
                </li>
              </ul>
            </div>

            <div className="p-10 rounded-[14px] relative overflow-hidden border border-[#E8EAED] bg-gradient-to-br from-[#FAFAFA] to-[#F0F1F3] shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3B82F6]" />
              <h2 className="text-2xl font-athletic font-semibold mb-4 text-[#212529] uppercase tracking-wide">
                Who it&apos;s for
              </h2>
              <p className="text-lg text-[#495057] leading-relaxed mb-4">
                High school and serious youth programs where time is scarce, expectations are high, and the head coach is still the
                default chief operating officer. If that sounds like your building, Braik is built for you.
              </p>
              <p className="text-sm text-[#6c757d]">
                Questions about cost? Start with{" "}
                <Link href="/pricing#how-much-braik-costs" className="text-[#2563EB] font-medium hover:underline">
                  pricing
                </Link>{" "}
                or the{" "}
                <Link href="/faq" className="text-[#2563EB] font-medium hover:underline">
                  FAQ
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
