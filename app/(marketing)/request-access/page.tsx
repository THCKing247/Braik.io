import Link from "next/link"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { Button } from "@/components/ui/button"
import { LeadCaptureForm } from "@/components/marketing/lead-capture-form"

export const metadata = {
  title: "Request access | Braik",
  description: "Contact Braik to request access to the platform. Accounts are created by your administrator.",
}

export default function RequestAccessPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-16 md:py-24">
        <h1 className="font-athletic text-4xl font-bold uppercase tracking-tight text-[#212529] md:text-5xl">
          Request access
        </h1>
        <p className="mt-4 text-lg text-[#495057]">
          Braik accounts are issued by your program or school administrator. If you need access, reach out to your
          coach or athletic staff, or contact us and we will route your request.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login">
            <Button size="lg" variant="outline" className="border-slate-300">
              Sign in
            </Button>
          </Link>
          <a href="mailto:support@braik.io">
            <Button size="lg">Contact us</Button>
          </a>
        </div>
        <section className="mt-14 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] p-6 md:p-8">
          <h2 className="text-lg font-semibold text-[#212529]">Send us a note</h2>
          <p className="mt-2 text-sm text-[#6c757d]">
            Tell us who you are (school, role, sport). We will follow up with next steps.
          </p>
          <div className="mt-6">
            <LeadCaptureForm />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
