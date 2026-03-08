"use client"

import { useEffect } from "react"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { TeamPriceCalculator } from "@/components/pricing/team-price-calculator"
import { PricingComparison } from "@/components/pricing/pricing-comparison"
import { PricingFaq } from "@/components/pricing/pricing-faq"
import { trackMarketingEvent } from "@/lib/utils/analytics-client"

const cardStyle = {
  backgroundColor: "rgba(28, 28, 28, 0.9)",
  backdropFilter: "blur(6px)",
  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
}

export default function PricingPage() {
  useEffect(() => {
    trackMarketingEvent("viewed_pricing", { source: "pricing_page" })
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#F8FAFC] via-white to-white pt-16 pb-12 md:pt-24 md:pb-16">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#3B82F6]/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#60A5FA]/10 blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative z-10 text-center max-w-3xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-6">
            Simple pricing for serious programs
          </h1>
          <p className="text-lg md:text-xl text-[#212529]/85 leading-relaxed">
            Braik is built for coaches, teams, and athletic departments that want a better way to manage athletes, communication, development, and program operations without complicated software pricing.
          </p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="relative py-12 md:py-16">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 -left-24 h-72 w-72 rounded-full bg-[#3B82F6]/5 blur-3xl" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto space-y-10">
            {/* Team Program Pricing Card */}
            <div
              className="p-8 md:p-10 rounded-[14px] relative overflow-hidden text-[#FFFFFF]"
              style={cardStyle}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3B82F6]" />
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl md:text-3xl font-athletic font-semibold mb-2 text-[#FFFFFF] uppercase tracking-wide">
                    Team Program Pricing
                  </h2>
                  <p className="text-lg text-[#FFFFFF]/90 leading-relaxed">
                    Best for individual teams and coaches getting started. Flexible payment options allow teams to cover athlete accounts or let players pay individually.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-lg font-semibold text-[#FFFFFF] mb-3 uppercase tracking-wide">
                      What&apos;s included
                    </h3>
                    <ul className="text-[#FFFFFF]/90 space-y-2">
                      <li>Head coach account</li>
                      <li>3 assistant coach accounts</li>
                      <li>1 parent account per athlete</li>
                      <li>Program analytics</li>
                      <li>Full team platform access</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#FFFFFF] mb-3 uppercase tracking-wide">
                      How billing works
                    </h3>
                    <ul className="text-[#FFFFFF]/90 space-y-2">
                      <li>$250 annual program fee</li>
                      <li>$10 per athlete</li>
                      <li>Minimum roster size depends on sport</li>
                      <li>$10 per additional assistant coach</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-[#FFFFFF] mb-3 uppercase tracking-wide">
                    Who pays options
                  </h3>
                  <p className="text-[#FFFFFF]/90 leading-relaxed">
                    The coach can cover athlete accounts, or athletes can pay $10 when they join. The same option applies to additional assistant coaches—either the program pays or each coach pays at signup.
                  </p>
                </div>

                <p className="text-2xl font-semibold text-[#FFFFFF] pt-2">
                  $250 per team per year · $10 per athlete · 3 coaches included
                </p>
              </div>
            </div>

            {/* Athletic Department License Card */}
            <div
              className="p-8 md:p-10 rounded-[14px] relative overflow-hidden text-[#FFFFFF]"
              style={cardStyle}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3B82F6]" />
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl md:text-3xl font-athletic font-semibold mb-2 text-[#FFFFFF] uppercase tracking-wide">
                    Athletic Department License
                  </h2>
                  <p className="text-lg text-[#FFFFFF]/90 leading-relaxed">
                    Best for schools that want one platform across every sport. Ideal for athletic directors who want centralized visibility across programs.
                  </p>
                </div>

                <p className="text-3xl font-bold text-[#FFFFFF]">
                  $3,500 per year
                </p>

                <div className="grid md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-lg font-semibold text-[#FFFFFF] mb-3 uppercase tracking-wide">
                      What&apos;s included
                    </h3>
                    <ul className="text-[#FFFFFF]/90 space-y-2">
                      <li>Unlimited teams</li>
                      <li>Unlimited athletes</li>
                      <li>Unlimited coaches</li>
                      <li>Athletic director dashboard</li>
                      <li>Department analytics</li>
                      <li>Centralized program management</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-[#FFFFFF] mb-3 uppercase tracking-wide">
                      How billing works
                    </h3>
                    <p className="text-[#FFFFFF]/90 leading-relaxed">
                      $3,500 annual license. One payment covers the entire athletic department.
                    </p>
                  </div>
                </div>
                <div className="pt-4">
                  <a
                    href="/signup/athletic-director"
                    className="inline-flex items-center justify-center rounded-lg bg-[#3B82F6] px-6 py-3 text-base font-semibold text-white hover:bg-[#2563EB] transition-colors"
                  >
                    Start Department Setup
                  </a>
                </div>
              </div>
            </div>

            {/* Comparison */}
            <div className="pt-8">
              <PricingComparison />
            </div>
          </div>
        </div>
      </section>

      {/* Calculator */}
      <section className="relative py-12 md:py-20 bg-gradient-to-b from-white via-[#F8FAFC]/50 to-white">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-2">
                Estimate your team cost
              </h2>
              <p className="text-[#212529]/80">
                See what Braik would cost for your program.
              </p>
            </div>
            <TeamPriceCalculator />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative py-12 md:py-20">
        <div className="container mx-auto px-4 relative z-10">
          <PricingFaq />
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
