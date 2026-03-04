import { redirect } from "next/navigation"
import { getServerSessionOrSupabase } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { DashboardNav } from "@/components/portal/dashboard-nav"
import { TeamSwitcher } from "@/components/portal/team-switcher"
import { AIWidgetWrapper } from "@/components/ai/ai-widget-wrapper"
import { SubscriptionGuard } from "@/components/portal/subscription-guard"
import { QuickActionsSidebar } from "@/components/portal/quick-actions-sidebar"
import { getActiveImpersonationFromCookies } from "@/lib/admin/impersonation"
import { SuspensionBanner } from "@/components/suspension-banner"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSessionOrSupabase()

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
  }> = []

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

  // Only redirect to onboarding if the user truly has no team association at all.
  // Newly registered head coaches will always have a team via signup-secure, so
  // this redirect should only trigger for legacy / platform-admin edge cases.
  if (teams.length === 0 && !session.user.isPlatformOwner) {
    redirect("/onboarding")
  }

  const currentTeamId = session.user.teamId || teams[0]?.id
  const currentTeam = teams.find((t) => t.id === currentTeamId) || teams[0]
  const primaryColor = currentTeam?.primaryColor || "#1e3a5f"
  const secondaryColor = currentTeam?.secondaryColor || "#FFFFFF"
  const isFootballProgram = (currentTeam?.sport || "").toLowerCase() === "football"

  const playerCount = currentTeam?.players?.length ?? 0
  const subscriptionAmount = playerCount * 5.0
  const amountPaid = currentTeam?.amountPaid ?? 0
  const remainingBalance = subscriptionAmount - amountPaid
  // Consider subscription paid when there is no outstanding balance (e.g. teams with
  // 0 players during pre-launch always have a $0.00 balance and should not be blocked).
  const subscriptionPaid = (currentTeam?.subscriptionPaid ?? false) || remainingBalance <= 0
  const impersonationSession = await getActiveImpersonationFromCookies()

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
