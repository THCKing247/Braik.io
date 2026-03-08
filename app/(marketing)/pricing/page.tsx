"use client"

import { useEffect } from "react"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { TeamPriceCalculator } from "@/components/pricing/team-price-calculator"
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

      <section className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#F8FAFC] via-white to-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#3B82F6]/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#60A5FA]/10 blur-3xl" />
        </div>

        <div className="container mx-auto px-4 py-20 relative z-10">
          <h2 className="text-4xl md:text-5xl font-athletic font-bold text-center mb-4 text-[#212529] uppercase tracking-tight">
            Simple Team Pricing
          </h2>
          <p className="text-center text-lg text-[#212529]/80 mb-12 max-w-2xl mx-auto">
            Built for coaches and programs of any size.
          </p>

          <div className="max-w-4xl mx-auto space-y-8">
            {/* Team Program Pricing Card */}
            <div
              className="p-10 rounded-[14px] relative overflow-hidden text-[#FFFFFF] space-y-8"
              style={cardStyle}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3B82F6]" />
              <div>
                <h3 className="text-2xl font-athletic font-semibold mb-4 text-[#FFFFFF] uppercase tracking-wide">
                  Team Program Pricing
                </h3>
                <p className="text-2xl font-semibold text-[#FFFFFF] mb-2 leading-relaxed">
                  $250 per team per year
                </p>
                <p className="text-lg text-[#FFFFFF]/90 mb-1">
                  $10 per athlete
                </p>
                <p className="text-lg text-[#FFFFFF]/90 mb-4">
                  $350 minimum
                </p>
                <ul className="text-lg text-[#FFFFFF] leading-relaxed space-y-2">
                  <li>Head coach account</li>
                  <li>3 assistant coaches included</li>
                  <li>1 parent account per player</li>
                  <li>Flexible payment options</li>
                  <li>Program analytics</li>
                </ul>
              </div>
            </div>

            {/* Athletic Department License Card */}
            <div
              className="p-10 rounded-[14px] relative overflow-hidden text-[#FFFFFF] space-y-8"
              style={cardStyle}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3B82F6]" />
              <div>
                <h3 className="text-2xl font-athletic font-semibold mb-4 text-[#FFFFFF] uppercase tracking-wide">
                  Athletic Department License
                </h3>
                <p className="text-2xl font-semibold text-[#FFFFFF] mb-4 leading-relaxed">
                  $3,500 per year
                </p>
                <ul className="text-lg text-[#FFFFFF] mb-4 leading-relaxed space-y-2">
                  <li>Unlimited teams</li>
                  <li>Unlimited athletes</li>
                  <li>Unlimited coaches</li>
                  <li>Athletic director dashboard</li>
                  <li>Department analytics</li>
                </ul>
                <p className="text-lg text-[#FFFFFF]/90 leading-relaxed">
                  For schools that want one platform for their entire athletic department.
                </p>
              </div>
            </div>

            {/* Pricing Calculator Section */}
            <div className="space-y-4">
              <h3 className="text-2xl font-athletic font-bold text-center text-[#212529] uppercase tracking-tight">
                Estimate Your Team Cost
              </h3>
              <p className="text-center text-[#212529]/80 mb-6">
                See what Braik would cost for your program.
              </p>
              <TeamPriceCalculator />
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
