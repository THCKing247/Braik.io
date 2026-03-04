import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export default function FAQPage() {
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
            FAQ
          </h2>
          <div className="max-w-3xl mx-auto space-y-6">
            <div
              className="p-6 rounded-[14px] relative overflow-hidden text-[#FFFFFF]"
              style={{
                backgroundColor: "rgba(28, 28, 28, 0.9)",
                backdropFilter: "blur(6px)",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3B82F6]" />
              <h3 className="text-xl font-athletic font-semibold mb-2 text-[#FFFFFF] uppercase">How much does Braik cost?</h3>
              <p className="text-[#FFFFFF]">Braik charges $5 per player per season. No monthly fees, no hidden costs.</p>
            </div>
            <div
              className="p-6 rounded-[14px] relative overflow-hidden text-[#FFFFFF]"
              style={{
                backgroundColor: "rgba(28, 28, 28, 0.9)",
                backdropFilter: "blur(6px)",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3B82F6]" />
              <h3 className="text-xl font-athletic font-semibold mb-2 text-[#FFFFFF] uppercase">What sports does Braik support?</h3>
              <p className="text-[#FFFFFF]">While built with football in mind, Braik works for all sports including basketball, soccer, baseball, and more.</p>
            </div>
            <div
              className="p-6 rounded-[14px] relative overflow-hidden text-[#FFFFFF]"
              style={{
                backgroundColor: "rgba(28, 28, 28, 0.9)",
                backdropFilter: "blur(6px)",
                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3B82F6]" />
              <h3 className="text-xl font-athletic font-semibold mb-2 text-[#FFFFFF] uppercase">How do I get started?</h3>
              <p className="text-[#FFFFFF]">Simply sign up, create your team, and start adding players. You can import your roster via CSV for faster setup.</p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
