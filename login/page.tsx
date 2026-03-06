"use client"

import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { HeroLoginForm } from "@/components/marketing/hero-login-form"
import { ScrollReveal } from "@/components/marketing/scroll-reveal"

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      
      <section className="relative py-32 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto">
            <ScrollReveal>
              <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-4">
                  Welcome back
                </h1>
                <p className="text-lg text-[#495057]">
                  Sign in to your Braik account
                </p>
              </div>
              <HeroLoginForm />
            </ScrollReveal>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
