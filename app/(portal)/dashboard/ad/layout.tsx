import { redirect } from "next/navigation"
import { getServerSessionOrSupabase } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  canAccessAdPortalRoutes,
  getAdPortalTabVisibility,
  resolveFootballAdAccessState,
} from "@/lib/enforcement/football-ad-access"
import { AdNav } from "@/components/portal/ad/ad-nav"

export const dynamic = "force-dynamic"

export default async function AthleticDirectorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSessionOrSupabase()
  if (!session?.user?.id) {
    redirect("/login")
  }
  const supabase = getSupabaseServer()
  const footballAccess = await resolveFootballAdAccessState(supabase, session.user.id)
  if (!canAccessAdPortalRoutes(footballAccess)) {
    redirect("/dashboard")
  }

  const tabVisibility = getAdPortalTabVisibility(footballAccess)

  return (
    <div className="min-h-screen" style={{ backgroundColor: "rgb(var(--snow))" }}>
      <AdNav userEmail={session.user.email} tabVisibility={tabVisibility} />
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  )
}
