import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { isPlatformOwner } from "@/lib/platform-owner"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { ScrollReveal } from "@/components/scroll-reveal"
import { AdminLoginForm } from "@/components/admin-login-form"

export default async function AdminLoginPage() {
  const session = await getServerSession(authOptions)

  if (session?.user?.id) {
    const hasAccess = await isPlatformOwner(session.user.id)
    redirect(hasAccess ? "/dashboard/admin" : "/dashboard")
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <section className="relative py-32 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto">
            <ScrollReveal>
              <div className="text-center mb-12">
                <h1 className="text-4xl md:text-5xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-4">
                  Admin Access
                </h1>
                <p className="text-lg text-[#495057]">
                  Separate login for platform support and backend management
                </p>
              </div>
              <AdminLoginForm />
            </ScrollReveal>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  )
}

