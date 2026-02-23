import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { DashboardNav } from "@/components/dashboard-nav"
import { TeamSwitcher } from "@/components/team-switcher"
import { AIWidgetWrapper } from "@/components/ai-widget-wrapper"
import { SubscriptionGuard } from "@/components/subscription-guard"
import { QuickActionsSidebar } from "@/components/quick-actions-sidebar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect("/login")
  }

  // Get all user's teams
  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    include: {
      team: {
        include: {
          organization: true,
          players: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const teams = memberships.map((m) => m.team)
  
  // Get current team for colors (use teamId from session or first team)
  const currentTeamId = session.user.teamId || teams[0]?.id
  const currentTeam = teams.find(t => t.id === currentTeamId) || teams[0]
  const primaryColor = currentTeam?.primaryColor || "#1e3a5f"
  const secondaryColor = currentTeam?.secondaryColor || "#FFFFFF"
  const isFootballProgram = (currentTeam?.sport || "").toLowerCase() === "football"

  // Calculate subscription info
  const subscriptionPaid = (currentTeam as any)?.subscriptionPaid || false
  const playerCount = currentTeam?.players?.length || 0
  const subscriptionAmount = playerCount * 5.0
  const amountPaid = (currentTeam as any)?.amountPaid || 0
  const remainingBalance = subscriptionAmount - amountPaid

  return (
    <div className="app-shell" style={{ backgroundColor: "rgb(var(--snow))" }}>
      <DashboardNav teams={teams} />
      {/* Quick Actions Toolbar - fixed rail, sibling to app-content */}
      <QuickActionsSidebar />
      {/* Main content wrapper - offset applied via .app-content class */}
      <main className="app-content" style={{ backgroundColor: "rgb(var(--snow))" }}>
        <SubscriptionGuard subscriptionPaid={subscriptionPaid} remainingBalance={remainingBalance}>
          {children}
        </SubscriptionGuard>
      </main>
      <AIWidgetWrapper />
    </div>
  )
}
