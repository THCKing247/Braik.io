/**
 * Dashboard layout — keep server work minimal for fast soft navigations:
 * - Session once per request (cached via getCachedServerSession).
 * - Team list for nav/switcher only: id + name via loadDashboardShellTeams (no roster, stats, events, etc.).
 * Heavy data belongs on each page or client hooks, not here.
 */
import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { cookies } from "next/headers"
import { isRedirectError } from "next/dist/client/components/redirect"
import { getCachedServerSession } from "@/lib/auth/cached-server-session"
import { loadDashboardShellTeams } from "@/lib/dashboard/load-dashboard-teams"
import { BRAIK_DASHBOARD_TEAM_HINT_COOKIE } from "@/lib/navigation/dashboard-team-hint-cookie"
import { DashboardNav } from "@/components/portal/dashboard-nav"
import { SubscriptionGuard } from "@/components/portal/subscription-guard"
import { DashboardLayoutClient } from "@/components/portal/dashboard-layout-client"
import { DashboardShellWithMobileNav } from "@/components/portal/dashboard-shell-with-mobile-nav"
import { getActiveImpersonationFromCookies } from "@/lib/admin/impersonation"
import { ImpersonationBanner } from "@/components/admin/impersonation-banner"
import { SuspensionBanner } from "@/components/marketing/suspension-banner"
import { CoachPageDebug } from "@/components/portal/coach-page-debug"

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
  let session: Awaited<ReturnType<typeof getCachedServerSession>>
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
    // Session and impersonation cookie are independent — resolve in parallel to shave latency on Netlify.
    const [resolvedSession, resolvedImpersonation] = await Promise.all([
      getCachedServerSession(),
      getActiveImpersonationFromCookies(),
    ])
    session = resolvedSession
    impersonationSession = resolvedImpersonation

    if (!session?.user?.id) {
      redirect("/login")
    }

    const userRole = session.user.role?.toUpperCase()
    if (userRole === "ATHLETIC_DIRECTOR") {
      return <>{children}</>
    }

    const dashboardPath = headers().get("x-dashboard-pathname") ?? ""
    if (dashboardPath.startsWith("/dashboard/ad")) {
      return <>{children}</>
    }

    // When impersonating, load the target user's teams; otherwise use session user
    const effectiveUserId = impersonationSession?.target_user_id ?? session.user.id
    const isImpersonating = Boolean(impersonationSession)

    teams = await loadDashboardShellTeams(
      effectiveUserId,
      session.user.id,
      session.user.teamId,
      isImpersonating
    )

    const dashboardTeamHint = cookies().get(BRAIK_DASHBOARD_TEAM_HINT_COOKIE)?.value ?? null

    // Head Coaches must always have a team — redirect to onboarding only for them.
    const layoutUserRole = session.user.role?.toUpperCase()
    if (teams.length === 0 && layoutUserRole === "HEAD_COACH" && !session.user.isPlatformOwner) {
      redirect("/onboarding")
    }

    // Resolve currentTeamId only from teams we actually loaded (never use stale session.teamId that no longer exists)
    const validTeamIds = new Set(teams.map((t) => t.id))
    const sessionTeamId = session.user.teamId
    const hintOk =
      userRole === "ATHLETIC_DIRECTOR" &&
      dashboardTeamHint &&
      validTeamIds.has(dashboardTeamHint)
    const currentTeamId = impersonationSession
      ? teams[0]?.id
      : hintOk
        ? dashboardTeamHint
        : sessionTeamId && validTeamIds.has(sessionTeamId)
          ? sessionTeamId
          : teams[0]?.id ?? ""
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
      <DashboardShellWithMobileNav
        teams={teams}
        showAdminLink={Boolean(session.user?.isPlatformOwner)}
      >
        <div className="app-shell flex min-h-screen flex-col bg-background">
          <header className="shrink-0">
            <Suspense
              fallback={
                <div
                  className="min-h-[52px] w-full border-b border-border bg-card pt-[env(safe-area-inset-top,0px)]"
                  style={{ minHeight: "max(52px, calc(52px + env(safe-area-inset-top, 0px)))" }}
                />
              }
            >
              <DashboardNav teams={teams} />
            </Suspense>
          </header>
          <DashboardLayoutClient teams={teams} currentTeamId={currentTeamId} className="flex w-full min-w-0 flex-col">
            {process.env.NODE_ENV === "development" ? (
              <CoachPageDebug
                session={session}
                teamIds={teams.map((t) => t.id)}
                accessAllowed={true}
              />
            ) : null}
            {impersonationSession && <ImpersonationBanner />}
            <SuspensionBanner teamStatus={currentTeam?.teamStatus} role={session?.user?.role} />
            <SubscriptionGuard subscriptionPaid={subscriptionPaid} remainingBalance={remainingBalance}>
              {children}
            </SubscriptionGuard>
          </DashboardLayoutClient>
        </div>
      </DashboardShellWithMobileNav>
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
