import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { WaitlistForm } from "@/components/marketing/waitlist-form"

export const metadata: Metadata = {
  title: "Join the waitlist | Braik",
  description: "Request early access to Braik for your team or program.",
}

export default function WaitlistPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-b from-[#F8FAFC] via-white to-white py-16 md:py-24">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#3B82F6]/10 blur-3xl" />
            <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#60A5FA]/10 blur-3xl" />
          </div>
          <div className="container relative z-10 mx-auto px-4 max-w-xl">
            <div className="relative rounded-2xl border border-[#E5E7EB] bg-white/90 shadow-sm backdrop-blur-sm p-8 md:p-10 overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3B82F6]" aria-hidden />
              <h1 className="text-3xl md:text-4xl font-athletic font-bold text-[#212529] uppercase tracking-tight text-center">
                Braik is almost here
              </h1>
              <p className="mt-3 text-center text-[#495057] text-base md:text-lg leading-relaxed">
                Join the waitlist to get early access for your team.
              </p>
              <div className="mt-10">
                <WaitlistForm />
              </div>
              <p className="mt-8 text-center text-sm text-[#6B7280]">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-[#3B82F6] hover:underline">
                  Log in
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
