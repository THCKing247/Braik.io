import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { WaitlistForm } from "@/components/marketing/waitlist-form"
import { MarketingCard } from "@/components/marketing/marketing-layout"
import { MarketingHeroBlobs, MarketingPageSection, MarketingShell } from "@/components/marketing/marketing-page"

export const metadata: Metadata = {
  title: "Join the waitlist | Braik",
  description: "Request early access to Braik for your team or program.",
}

export default function WaitlistPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <MarketingPageSection variant="gradient" className="overflow-hidden">
          <MarketingHeroBlobs />
          <MarketingShell className="relative z-10 max-w-xl mx-auto">
            <MarketingCard
              title="Braik is almost here"
              className="text-center [&_h3]:mx-auto [&_h3]:text-center shadow-md"
            >
              <p className="mt-2 text-[#212529]/80 text-base md:text-lg leading-relaxed">
                Join the waitlist to get early access for your team.
              </p>
              <div className="mt-10">
                <WaitlistForm />
              </div>
              <p className="mt-8 text-sm text-[#64748B]">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-[#3B82F6] hover:underline">
                  Log in
                </Link>
              </p>
            </MarketingCard>
          </MarketingShell>
        </MarketingPageSection>
      </main>
      <SiteFooter />
    </div>
  )
}
