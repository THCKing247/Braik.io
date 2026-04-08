import Link from "next/link"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { Button } from "@/components/ui/button"
import { LeadCaptureForm } from "@/components/marketing/lead-capture-form"
import { MarketingCard } from "@/components/marketing/marketing-layout"
import {
  MarketingHeroShell,
  MarketingPageSection,
  MarketingShell,
  MarketingContentContainer,
  marketingBodyClass,
  marketingMutedClass,
  marketingSectionTitleClass,
} from "@/components/marketing/marketing-page"
import { isWaitlistMode } from "@/lib/config/waitlist-mode"
import { getPlayerSignupHref, getProgramOrCoachAccessHref } from "@/lib/marketing/join-cta"

export const metadata = {
  title: "Get access | Braik",
  description:
    "Players sign up with a team join code or QR from their coach. Coaches and schools request access or contact Braik.",
}

export default function RequestAccessPage() {
  const playerHref = getPlayerSignupHref()
  const coachProgramHref = getProgramOrCoachAccessHref()
  const waitlist = isWaitlistMode()

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <MarketingHeroShell className="pb-8 md:pb-12">
        <MarketingContentContainer maxWidth="4xl" className="px-4 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-4">
            Get access
          </h1>
          <p className={`${marketingBodyClass} text-[#212529]/85 max-w-2xl mx-auto`}>
            Pick the path that matches you—players join with a code from their team. Coach and admin accounts are
            handled separately.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
            <Link href="/login" className="font-medium text-[#2563EB] hover:underline">
              Already have an account? Sign in
            </Link>
          </div>
        </MarketingContentContainer>
      </MarketingHeroShell>

      <MarketingPageSection variant="gradient" className="pt-0 md:pt-2 pb-16 md:pb-24">
        <MarketingShell>
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-10 max-w-6xl mx-auto items-start">
            {/* Players — first on mobile (QR scans) */}
            <div className="order-1 rounded-2xl border-2 border-[#BFDBFE] bg-gradient-to-b from-[#EFF6FF] to-white p-6 sm:p-8 shadow-sm shadow-[#3B82F6]/10">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#1D4ED8] mb-2">For players</p>
              <h2 className={`${marketingSectionTitleClass} text-left mb-3`}>Player sign up</h2>
              <p className={`${marketingBodyClass} text-[#212529]/85 text-left mb-2`}>
                If your coach gave you a Braik team code or QR code, use it to create your account and join your team.
              </p>
              <p className={`${marketingMutedClass} text-left mb-6`}>
                Your code connects you to the right roster—no open signup without a team.
              </p>
              <Link href={playerHref} className="block">
                <Button
                  size="lg"
                  className="w-full min-h-[56px] text-base bg-[#3B82F6] hover:bg-[#2563EB] font-athletic uppercase tracking-wide shadow-lg shadow-[#3B82F6]/25"
                >
                  Sign up as a player
                </Button>
              </Link>
              <p className={`mt-4 text-center ${marketingMutedClass}`}>Have a team code? Tap the button above.</p>
            </div>

            {/* Coaches / staff */}
            <div className="order-2 rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-2">For coaches &amp; schools</p>
              <h2 className={`${marketingSectionTitleClass} text-left mb-3 normal-case`}>Need coach or school access?</h2>
              <p className={`${marketingBodyClass} text-[#212529]/85 text-left mb-4`}>
                {waitlist
                  ? "Braik is opening in phases for new programs. Join the waitlist and we’ll follow up with next steps."
                  : "Coach and administrator access is provisioned for your program. Contact us and we’ll help route your request."}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-8">
                <Button asChild size="lg" variant="default" className="min-h-[48px] font-athletic uppercase tracking-wide flex-1">
                  <Link href={coachProgramHref}>{waitlist ? "Join program waitlist" : "Request coach access"}</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="min-h-[48px] border-slate-300 flex-1">
                  <a href="mailto:support@braik.io">Email us</a>
                </Button>
              </div>

              <MarketingCard title="Send a message" className="border-[#E5E7EB] bg-[#F9FAFB]/80">
                <p className={`${marketingMutedClass} mb-6 text-left`}>
                  School, role, and sport—we’ll follow up with the right next step.
                </p>
                <div id="coach-access-form">
                  <LeadCaptureForm />
                </div>
              </MarketingCard>
            </div>
          </div>
        </MarketingShell>
      </MarketingPageSection>

      <SiteFooter />
    </div>
  )
}
