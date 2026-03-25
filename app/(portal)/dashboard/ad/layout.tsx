import { redirect } from "next/navigation"
<<<<<<< HEAD
import { getServerSessionOrSupabase } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  canAccessAdPortalRoutes,
  getAdPortalTabVisibility,
  resolveFootballAdAccessState,
} from "@/lib/enforcement/football-ad-access"
=======
import { getCachedServerSession } from "@/lib/auth/cached-server-session"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getAdPortalAccessForUser, adPortalShowsOverviewAndSettings } from "@/lib/ad-portal-access"
>>>>>>> origin/main
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
<<<<<<< HEAD
  const supabase = getSupabaseServer()
  const footballAccess = await resolveFootballAdAccessState(supabase, session.user.id)
  if (!canAccessAdPortalRoutes(footballAccess)) {
    redirect("/dashboard")
  }

  const tabVisibility = getAdPortalTabVisibility(footballAccess)

  return (
    <div className="min-h-screen" style={{ backgroundColor: "rgb(var(--snow))" }}>
      <AdNav userEmail={session.user.email} tabVisibility={tabVisibility} />
=======

  const role = session.user.role?.toUpperCase() ?? ""
  if (role !== "ATHLETIC_DIRECTOR" && role !== "HEAD_COACH") {
    redirect("/dashboard")
  }

  const supabase = getSupabaseServer()
  const access = await getAdPortalAccessForUser(supabase, session.user.id, role)

  if (role === "HEAD_COACH" && access.mode === "none") {
    redirect("/dashboard")
  }

  const showOverviewAndSettings =
    role === "ATHLETIC_DIRECTOR" ? true : adPortalShowsOverviewAndSettings(access)

  return (
    <div className="min-h-screen" style={{ backgroundColor: "rgb(var(--snow))" }}>
      <AdNav
        userEmail={session.user.email}
        showOverviewAndSettings={showOverviewAndSettings}
      />
>>>>>>> origin/main
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  )
}
