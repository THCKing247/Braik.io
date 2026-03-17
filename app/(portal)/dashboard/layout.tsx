import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { isRedirectError } from "next/dist/client/components/redirect"
import { getServerSessionOrSupabase } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { DashboardNav } from "@/components/portal/dashboard-nav"
import { SubscriptionGuard } from "@/components/portal/subscription-guard"
import { DashboardLayoutClient } from "@/components/portal/dashboard-layout-client"
import { getActiveImpersonationFromCookies } from "@/lib/admin/impersonation"
import { ImpersonationBanner } from "@/components/admin/impersonation-banner"
import { SuspensionBanner } from "@/components/marketing/suspension-banner"
import { CoachPageDebug } from "@/components/portal/coach-page-debug"

export const dynamic = "force-dynamic"

/** Shown when the dashboard layout fails to load (avoids 500 and ERR_HTTP2 by returning 200). */
function DashboardLayoutFallback() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn&apos;t load the dashboard. This can happen due to a temporary connection or configuration issue.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary"
          >
            Try again
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let session: Awaited<ReturnType<typeof getServerSessionOrSupabase>>
  let teams: Array<{
    id: string
    name: string
    organization: { name: string }
    sport: string
    seasonName: string
    primaryColor?: string
    secondaryColor?: string
    teamStatus?: string
    subscriptionPaid?: boolean
    amountPaid?: number
    players?: unknown[]
  }>
  let currentTeam: { primaryColor?: string; secondaryColor?: string; sport?: string; teamStatus?: string; amountPaid?: number; subscriptionPaid?: boolean; players?: unknown[] } | undefined
  let subscriptionPaid: boolean
  let remainingBalance: number
  let impersonationSession: Awaited<ReturnType<typeof getActiveImpersonationFromCookies>>

  try {
    session = await getServerSessionOrSupabase()

    if (!session?.user?.id) {
      redirect("/login")
    }

    const userRole = session.user.role?.toUpperCase()
    if (userRole === "ATHLETIC_DIRECTOR") {
      return <>{children}</>
    }

    const supabase = getSupabaseServer()

    // When impersonating, load the target user's teams; otherwise use session user
    impersonationSession = await getActiveImpersonationFromCookies()
    const effectiveUserId = impersonationSession?.target_user_id ?? session.user.id

    // Load user's team(s) from profiles (production source of truth; no team_members table)
    const { data: profile } = await supabase
      .from("profiles")
      .select("team_id")
      .eq("id", effectiveUserId)
      .maybeSingle()

    let teamIds: string[] = []
    if (profile?.team_id) {
      teamIds = [profile.team_id]
    }
    // Include teams the user created (created_by) in case profile.team_id is not set yet
    if (teamIds.length === 0) {
      const { data: createdTeams } = await supabase
        .from("teams")
        .select("id")
        .eq("created_by", effectiveUserId)
      if (createdTeams?.length) {
        teamIds = createdTeams.map((t) => t.id)
      }
    }
    if (teamIds.length === 0 && session.user.teamId && effectiveUserId === session.user.id) {
      teamIds = [session.user.teamId]
    }

    teams = []

    if (teamIds.length > 0) {
      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", teamIds)

      teams = (teamsData ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        organization: { name: t.name ?? "" },
        sport: "football",
        seasonName: "",
        primaryColor: "#1e3a5f",
        secondaryColor: "#FFFFFF",
        teamStatus: "active",
        subscriptionPaid: false,
        amountPaid: 0,
        players: [],
      }))
    }

    // Head Coaches must always have a team — redirect to onboarding only for them.
    const layoutUserRole = session.user.role?.toUpperCase()
    if (teams.length === 0 && layoutUserRole === "HEAD_COACH" && !session.user.isPlatformOwner) {
      redirect("/onboarding")
    }

    // Resolve currentTeamId only from teams we actually loaded (never use stale session.teamId that no longer exists)
    const validTeamIds = new Set(teams.map((t) => t.id))
    const sessionTeamId = session.user.teamId
    const currentTeamId = impersonationSession
      ? teams[0]?.id
      : (sessionTeamId && validTeamIds.has(sessionTeamId) ? sessionTeamId : teams[0]?.id) ?? ""
    currentTeam = teams.find((t) => t.id === currentTeamId) || teams[0]

    // ── Dev mode: treat all accounts as fully paid ─────────────────────────
    // Remove these two lines and restore the payment calculation below when
    // Stripe is integrated and billing enforcement is ready at launch.
    remainingBalance = 0
    subscriptionPaid = true
    // ── Original calculation (restore at launch) ───────────────────────────
    // const playerCount = currentTeam?.players?.length ?? 0
    // const subscriptionAmount = playerCount * 5.0
    // const amountPaid = currentTeam?.amountPaid ?? 0
    // remainingBalance = subscriptionAmount - amountPaid
    // subscriptionPaid = (currentTeam?.subscriptionPaid ?? false) || remainingBalance <= 0
    // ──────────────────────────────────────────────────────────────────────

    return (
      <div
        className="app-shell flex flex-col min-h-screen min-h-0 bg-background"
        style={{
          height: "100vh",
          maxHeight: "100vh",
          overflow: "hidden",
        }}
      >
        <header className="flex-shrink-0">
          <Suspense fallback={
            <div className="h-[54px] w-full border-b border-border bg-card" />
          }>
            <DashboardNav teams={teams} />
          </Suspense>
        </header>
        <DashboardLayoutClient teams={teams} currentTeamId={currentTeamId} className="flex flex-1 min-h-0 min-w-0">
          <CoachPageDebug
            session={session}
            teamIds={teams.map((t) => t.id)}
            accessAllowed={true}
          />
          {impersonationSession && <ImpersonationBanner />}
          <SuspensionBanner teamStatus={currentTeam?.teamStatus} role={session?.user?.role} />
          <SubscriptionGuard subscriptionPaid={subscriptionPaid} remainingBalance={remainingBalance}>
            {children}
          </SubscriptionGuard>
        </DashboardLayoutClient>
      </div>
    )
  } catch (err) {
    if (isRedirectError(err)) throw err
    const message = err instanceof Error ? err.message : String(err)
    console.error("[dashboard layout] Server Components render failed:", message, err)
    // In development, rethrow so the overlay shows the real error.
    if (process.env.NODE_ENV === "development") {
      throw err
    }
    // In production, return fallback UI so the request returns 200 and avoids 500 + ERR_HTTP2_PROTOCOL_ERROR.
    return <DashboardLayoutFallback />
  }
}
