import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export default function FAQPage() {
  return (
    <div className="min-h-screen text-[#FFFFFF] bg-[#64748B]">
      <SiteHeader />
      
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-athletic font-bold text-center mb-12 text-[#FFFFFF] uppercase tracking-wide">
          FAQ
        </h2>
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="p-6 bg-[#1e3a5f] rounded-xl border-2 border-[#1e3a5f] text-[#FFFFFF]">
            <h3 className="text-xl font-athletic font-semibold mb-2 text-[#FFFFFF] uppercase">How much does Braik cost?</h3>
            <p className="text-[#FFFFFF]">Braik charges $5 per player per season. No monthly fees, no hidden costs.</p>
          </div>
          <div className="p-6 bg-[#1e3a5f] rounded-xl border-2 border-[#1e3a5f] text-[#FFFFFF]">
            <h3 className="text-xl font-athletic font-semibold mb-2 text-[#FFFFFF] uppercase">What sports does Braik support?</h3>
            <p className="text-[#FFFFFF]">While built with football in mind, Braik works for all sports including basketball, soccer, baseball, and more.</p>
          </div>
          <div className="p-6 bg-[#1e3a5f] rounded-xl border-2 border-[#1e3a5f] text-[#FFFFFF]">
            <h3 className="text-xl font-athletic font-semibold mb-2 text-[#FFFFFF] uppercase">How do I get started?</h3>
            <p className="text-[#FFFFFF]">Simply sign up, create your team, and start adding players. You can import your roster via CSV for faster setup.</p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
