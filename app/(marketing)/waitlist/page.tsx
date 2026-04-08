import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { WaitlistForm } from "@/components/marketing/waitlist-form"
import { ImagePlaceholder } from "@/components/marketing/image-placeholder"
import { SectionSplit } from "@/components/marketing/section-split"
import {
  MarketingHeroBlobs,
  MarketingPageSection,
  MarketingShell,
  marketingSectionShell,
  marketingPageTitleClass,
} from "@/components/marketing/marketing-page"
import { landingContainerSplit } from "@/lib/marketing/landing-visual-theme"

export const metadata: Metadata = {
  title: "Join the waitlist | Braik",
  description: "Request early access to Braik for your team or program.",
}

export default function WaitlistPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-b from-[#F8FAFC] via-white to-white pt-16 pb-10 md:pt-24 md:pb-16">
          <MarketingHeroBlobs />
          <div className={`${marketingSectionShell} relative z-10 mx-auto max-w-3xl text-center`}>
            <h1 className={marketingPageTitleClass}>Join the waitlist</h1>
            <p className="text-lg leading-relaxed text-slate-800 md:text-xl">
              Braik is opening in phases. Add your program to the list and we will reach out when early access is available for your
              team.
            </p>
            <p className="mt-8 max-w-xl mx-auto rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-left text-base text-slate-800 shadow-sm">
              <span className="font-semibold text-[#1E40AF]">Are you a player?</span> Use your team join code or QR from your coach to{" "}
              <Link href="/signup/player" className="font-medium text-[#2563EB] underline decoration-[#93C5FD] underline-offset-2 hover:text-[#1D4ED8]">
                sign up here
              </Link>
              — you do not need this program waitlist.
            </p>
          </div>
        </section>

        <MarketingPageSection variant="white" className="py-20 md:py-24">
          <div className={landingContainerSplit}>
            <SectionSplit className="items-start md:items-center">
              <div className="min-w-0 space-y-6">
                <h2 className="font-athletic text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">Who it is for</h2>
                <p className="text-base leading-relaxed text-slate-800 md:text-lg">
                  High school football programs and staff who want one connected system for operations—scheduling, communication,
                  rosters, and more—without juggling a pile of disconnected tools.
                </p>
                <ul className="list-none space-y-3 pl-0 text-sm leading-relaxed text-slate-700 md:text-base" role="list">
                  {[
                    "Head coaches and program leaders planning ahead",
                    "Athletic departments evaluating options for football",
                    "Staff who want early visibility into Braik before wider rollout",
                  ].map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3B82F6]" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="min-w-0">
                <ImagePlaceholder aspect="4/3" />
              </div>
            </SectionSplit>
          </div>
        </MarketingPageSection>

        <MarketingPageSection variant="gradient" id="waitlist-form" className="scroll-mt-24 py-20 md:py-24">
          <MarketingShell className="max-w-2xl">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-md md:p-10">
              <h2 className="mb-2 font-athletic text-xl font-bold text-slate-900 md:text-2xl">Request your spot</h2>
              <p className="mb-8 text-sm leading-relaxed text-slate-700 md:text-base">
                Tell us who you are and how to reach you. No payment required—this only puts your program on our early-access list.
              </p>
              <WaitlistForm />
              <p className="mt-8 text-center text-sm text-slate-700">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-blue-700 hover:text-blue-800 hover:underline">
                  Log in
                </Link>
              </p>
            </div>
          </MarketingShell>
        </MarketingPageSection>
      </main>
      <SiteFooter />
    </div>
  )
}
