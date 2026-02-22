import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export default function PricingPage() {
  return (
    <div className="min-h-screen text-[#FFFFFF] bg-[#64748B]">
      <SiteHeader />
      
      <section 
        className="relative min-h-screen bg-cover bg-no-repeat"
        style={{
          backgroundImage: 'url(/hero-background.jpg)',
          backgroundPosition: 'center 60%',
        }}
      >
        {/* Left-to-right gradient scrim */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#64748B]/70 via-[#64748B]/50 to-[#64748B]/30"></div>
        
        <div className="container mx-auto px-4 py-20 relative z-10">
          <h2 className="text-3xl font-athletic font-bold text-center mb-12 text-[#FFFFFF] uppercase tracking-wide drop-shadow-lg">
            PRICING
          </h2>
          <div className="max-w-4xl mx-auto">
            <div className="p-10 bg-[#1e3a5f] rounded-xl border-2 border-[#1e3a5f] text-[#FFFFFF] space-y-8">
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
