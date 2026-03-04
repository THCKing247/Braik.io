import { redirect } from "next/navigation"
import { getServerSessionOrSupabase } from "@/lib/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { DashboardNav } from "@/components/dashboard-nav"
import { TeamSwitcher } from "@/components/team-switcher"
import { AIWidgetWrapper } from "@/components/ai-widget-wrapper"
import { SubscriptionGuard } from "@/components/subscription-guard"
import { QuickActionsSidebar } from "@/components/quick-actions-sidebar"
import { getActiveImpersonationFromCookies } from "@/lib/impersonation"
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

  const teamIds = [...new Set((memberships ?? []).map((m) => m.team_id))]

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

  if (teams.length === 0 && !session.user.isPlatformOwner) {
    redirect("/onboarding")
  }

  const currentTeamId = session.user.teamId || teams[0]?.id
  const currentTeam = teams.find((t) => t.id === currentTeamId) || teams[0]
  const primaryColor = currentTeam?.primaryColor || "#1e3a5f"
  const secondaryColor = currentTeam?.secondaryColor || "#FFFFFF"
  const isFootballProgram = (currentTeam?.sport || "").toLowerCase() === "football"

  const subscriptionPaid = currentTeam?.subscriptionPaid ?? false
  const playerCount = currentTeam?.players?.length ?? 0
  const subscriptionAmount = playerCount * 5.0
  const amountPaid = currentTeam?.amountPaid ?? 0
  const remainingBalance = subscriptionAmount - amountPaid
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
