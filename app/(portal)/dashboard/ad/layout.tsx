import { redirect } from "next/navigation"
import { getCachedServerSession } from "@/lib/auth/cached-server-session"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getAdPortalAccessForUser, adPortalShowsOverviewAndSettings } from "@/lib/ad-portal-access"
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
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  )
}
