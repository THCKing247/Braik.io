import { redirect } from "next/navigation"
import { getCachedServerSession } from "@/lib/auth/cached-server-session"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { canAccessAdPortalRoutes, resolveFootballAdAccessState } from "@/lib/enforcement/football-ad-access"
import { getCachedAdPortalBootstrapRequest } from "@/lib/app/ad-portal-bootstrap-server"
import { AdAppBootstrapProvider } from "@/components/portal/ad-app-bootstrap-context"
import { AdNav } from "@/components/portal/ad/ad-nav"

export default async function AthleticDirectorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getCachedServerSession()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const supabase = getSupabaseServer()
  const footballAccess = await resolveFootballAdAccessState(supabase, session.user.id)
  if (!canAccessAdPortalRoutes(footballAccess)) {
    redirect("/dashboard")
  }

  const adBootstrap = await getCachedAdPortalBootstrapRequest(
    session.user.id,
    session.user.email ?? "",
    session.user.role ?? "",
    session.user.isPlatformOwner === true
  )

  return (
    <AdAppBootstrapProvider initialPayload={adBootstrap}>
      <div className="min-h-screen" style={{ backgroundColor: "rgb(var(--snow))" }}>
        <AdNav />
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      </div>
    </AdAppBootstrapProvider>
  )
}
