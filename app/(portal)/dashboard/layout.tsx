import { redirect } from "next/navigation"
import { isRedirectError } from "next/dist/client/components/redirect"
import { getServerSessionOrSupabase } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { DashboardNav } from "@/components/portal/dashboard-nav"
import { TeamSwitcher } from "@/components/portal/team-switcher"
import { AIWidgetWrapper } from "@/components/ai/ai-widget-wrapper"
import { SubscriptionGuard } from "@/components/portal/subscription-guard"
import { QuickActionsSidebar } from "@/components/portal/quick-actions-sidebar"
import { getActiveImpersonationFromCookies } from "@/lib/admin/impersonation"
import { SuspensionBanner } from "@/components/suspension-banner"

export const dynamic = "force-dynamic"

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

    const supabase = getSupabaseServer()

    // Load user's teams via team_members (Supabase)
    const { data: memberships } = await supabase
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", session.user.id)
      .eq("active", true)

    let teamIds = [...new Set((memberships ?? []).map((m) => m.team_id))]

    // Fallback: if no team_members row exists yet (e.g. just signed up and the
    // team_members insert is still propagating), read team_id directly from the
    // user's profile so they land on the dashboard without an onboarding detour.
    if (teamIds.length === 0 && session.user.teamId) {
      teamIds = [session.user.teamId]
    }

    // Second fallback: read profile directly in case session.user.teamId is stale
    if (teamIds.length === 0) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("team_id")
        .eq("id", session.user.id)
        .maybeSingle()
      if (profile?.team_id) {
        teamIds = [profile.team_id]
      }
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
    const userRole = session.user.role?.toUpperCase()
    if (teams.length === 0 && userRole === "HEAD_COACH" && !session.user.isPlatformOwner) {
      redirect("/onboarding")
    }

    const currentTeamId = session.user.teamId || teams[0]?.id
    currentTeam = teams.find((t) => t.id === currentTeamId) || teams[0]
    const playerCount = currentTeam?.players?.length ?? 0
    const subscriptionAmount = playerCount * 5.0
    const amountPaid = currentTeam?.amountPaid ?? 0
    remainingBalance = subscriptionAmount - amountPaid
    subscriptionPaid = (currentTeam?.subscriptionPaid ?? false) || remainingBalance <= 0
    impersonationSession = await getActiveImpersonationFromCookies()
  } catch (err) {
    if (isRedirectError(err)) throw err
    const message = err instanceof Error ? err.message : String(err)
    console.error("[dashboard layout] Server Components render failed:", message, err)
    // In development, rethrow the original error so the overlay shows the real cause.
    // In production, Next.js omits the message in the client; check server logs for the message above.
    if (process.env.NODE_ENV === "development") {
      throw err
    }
    throw new Error(
      "[dashboard] failed to load session or teams: " + message
    )
  }

  return (
    <div className="app-shell" style={{ backgroundColor: "rgb(var(--snow))" }}>
      <DashboardNav teams={teams} />
      <QuickActionsSidebar />
      <main className="app-content" style={{ backgroundColor: "rgb(var(--snow))" }}>
        {impersonationSession && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-900">
            Support Session Active - you are viewing as another user. Bank/payout changes are disabled.
          </div>
        )}
        <SuspensionBanner teamStatus={currentTeam?.teamStatus} role={session.user.role} />
        <SubscriptionGuard subscriptionPaid={subscriptionPaid} remainingBalance={remainingBalance}>
          {children}
        </SubscriptionGuard>
      </main>
      <AIWidgetWrapper />
    </div>
  )
}
