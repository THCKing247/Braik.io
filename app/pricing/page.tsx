"use client"

import { useEffect } from "react"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { trackMarketingEvent } from "@/lib/analytics-client"

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
          <h2 className="text-4xl md:text-5xl font-athletic font-bold text-center mb-12 text-[#212529] uppercase tracking-tight">
            PRICING
          </h2>
          <div className="max-w-4xl mx-auto">
            <div
              className="p-10 rounded-[14px] relative overflow-hidden text-[#FFFFFF] space-y-8"
              style={{
                backgroundColor: "rgba(28, 28, 28, 0.9)",
                backdropFilter: "blur(6px)",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3B82F6]" />
              <div>
                <h3 className="text-2xl font-athletic font-semibold mb-4 text-[#FFFFFF] uppercase tracking-wide">
                  Simple, Program-Based Pricing
                </h3>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Braik uses a transparent annual pricing model based on roster size across the entire program.
                </p>
                <p className="text-2xl font-semibold text-[#FFFFFF] mb-4 leading-relaxed text-center">
                  $5 per player, per year.
                </p>
                <p className="text-lg text-[#FFFFFF] mb-4 leading-relaxed">
                  Pricing renews annually and is calculated based on the total number of players across the program, including Varsity and JV teams.
                </p>
                <p className="text-lg text-[#FFFFFF] leading-relaxed">
                  One payment covers the full platform for the entire program.
                </p>
              </div>

              <div>
                <h3 className="text-2xl font-athletic font-semibold mb-4 text-[#FFFFFF] uppercase tracking-wide">
                  Typical Annual Pricing by Sport
                </h3>
                <ul className="text-lg text-[#FFFFFF] mb-4 leading-relaxed space-y-2">
                  <li>Football (40–70 players): $200–$350 per year</li>
                  <li>Basketball (12–18 players): $60–$90 per year</li>
                  <li>Baseball / Softball (15–25 players): $75–$125 per year</li>
                  <li>Soccer (18–30 players): $90–$150 per year</li>
                  <li>Hockey (18–25 players): $90–$125 per year</li>
                  <li>Lacrosse (25–40 players): $125–$200 per year</li>
                </ul>
                <p className="text-lg text-[#FFFFFF] leading-relaxed">
                  Pricing is designed to align with team dues and seasonal planning, making it easy for programs to budget without sacrificing tools.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
