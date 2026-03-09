import Link from "next/link"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { isRedirectError } from "next/dist/client/components/redirect"
import { getServerSessionOrSupabase } from "@/lib/auth/server-auth"
import { getUserMembership } from "@/lib/auth/rbac"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { DashboardNav } from "@/components/portal/dashboard-nav"
import { TeamSwitcher } from "@/components/portal/team-switcher"
import { AIWidgetWrapper } from "@/components/ai/ai-widget-wrapper"
import { SubscriptionGuard } from "@/components/portal/subscription-guard"
import { QuickActionsSidebar } from "@/components/portal/quick-actions-sidebar"
import { getActiveImpersonationFromCookies } from "@/lib/admin/impersonation"
import { ImpersonationBanner } from "@/components/admin/impersonation-banner"
import { SuspensionBanner } from "@/components/marketing/suspension-banner"
import { CoachPageDebug } from "@/components/portal/coach-page-debug"

export const dynamic = "force-dynamic"

/** Shown when the dashboard layout fails to load (avoids 500 and ERR_HTTP2 by returning 200). */
function DashboardLayoutFallback() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-6" style={{ backgroundColor: "rgb(var(--snow))" }}>
      <div className="w-full max-w-md rounded-lg border bg-white p-8 text-center shadow-sm" style={{ borderColor: "rgb(var(--border))" }}>
        <h2 className="text-xl font-bold" style={{ color: "rgb(var(--text))" }}>Something went wrong</h2>
        <p className="mt-2 text-sm" style={{ color: "rgb(var(--muted))" }}>
          We couldn&apos;t load the dashboard. This can happen due to a temporary connection or configuration issue.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium"
            style={{ borderColor: "rgb(var(--accent))", color: "rgb(var(--accent))" }}
          >
            Try again
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "rgb(var(--accent))" }}
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

    // Load user's teams via team_members (Supabase)
    const { data: memberships } = await supabase
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", effectiveUserId)
      .eq("active", true)

    let teamIds = [...new Set((memberships ?? []).map((m) => m.team_id))]

    // Fallback: if no team_members row exists yet (e.g. just signed up and the
    // team_members insert is still propagating), read team_id directly from the
    // user's profile so they land on the dashboard without an onboarding detour.
    let usedProfileFallback = false
    if (teamIds.length === 0 && session.user.teamId && effectiveUserId === session.user.id) {
      teamIds = [session.user.teamId]
      usedProfileFallback = true
    }

    // Second fallback: read profile directly in case session.user.teamId is stale
    if (teamIds.length === 0) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("team_id")
        .eq("id", effectiveUserId)
        .maybeSingle()
      if (profile?.team_id) {
        teamIds = [profile.team_id]
        usedProfileFallback = true
      }
    }

    // Repair: if we used profile fallback, ensure team_members row exists so roster/APIs work.
    if (usedProfileFallback && teamIds.length > 0 && effectiveUserId === session.user.id) {
      await getUserMembership(teamIds[0])
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

    const currentTeamId = impersonationSession
      ? teams[0]?.id
      : (session.user.teamId || teams[0]?.id)
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
      <div className="app-shell" style={{ backgroundColor: "rgb(var(--snow))" }}>
        {/* Suspense is required here because DashboardNav uses useSearchParams() */}
        <Suspense fallback={
          <div className="h-[54px] w-full border-b" style={{ backgroundColor: "#FFFFFF", borderColor: "rgb(var(--border))" }} />
        }>
          <DashboardNav teams={teams} />
        </Suspense>
        <QuickActionsSidebar />
        <main className="app-content" style={{ backgroundColor: "rgb(var(--snow))" }}>
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
        </main>
        <AIWidgetWrapper />
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
