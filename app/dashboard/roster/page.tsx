import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamPermission } from "@/lib/rbac"
import { buildPlayerFilter } from "@/lib/data-filters"
import { RosterManagerEnhanced } from "@/components/roster-manager-enhanced"

export default async function RosterPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session?.user?.teamId || !session?.user?.role) {
    redirect("/login")
  }

  const teamId = session.user.teamId
  const userRole = session.user.role
  const positionGroups = session.user.positionGroups as string[] | null | undefined

  // Get membership to check permissions
  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      teamId: teamId,
    },
    include: { 
      team: {
        select: {
          id: true,
          sport: true,
        },
      },
    },
  })

  if (!membership) {
    redirect("/onboarding")
  }

  // Check permissions
  try {
    await requireTeamPermission(membership.teamId, "edit_roster")
  } catch {
    // Allow view-only for players/parents
  }

  // Build filter based on role
  const playerFilter = await buildPlayerFilter(
    session.user.id,
    userRole,
    teamId,
    positionGroups
  )

  const players = await prisma.player.findMany({
    where: playerFilter,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      grade: true,
      jerseyNumber: true,
      positionGroup: true,
      status: true,
      notes: true,
      imageUrl: true,
      user: { select: { email: true } },
      guardianLinks: {
        include: {
          guardian: {
            include: { user: { select: { email: true } } },
          },
        },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })

  const canEdit = userRole === "HEAD_COACH" || (userRole === "ASSISTANT_COACH" && !!positionGroups && positionGroups.length > 0)

  return (
    <div>
      <div className="mb-8">
        <div className="mb-4">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "#111827" }}>Roster</h1>
          <p style={{ color: "#6B7280" }}>
            {userRole === "PARENT" 
              ? "View your child's roster information" 
              : userRole === "ASSISTANT_COACH"
              ? `View players in your position groups: ${positionGroups?.join(", ") || "None assigned"}`
              : membership.team.sport?.toLowerCase() === "football"
              ? "Manage your team roster and depth charts"
              : "Manage your team roster"}
          </p>
        </div>
      </div>

      {/* Roster Manager */}
      <RosterManagerEnhanced 
        teamId={membership.teamId} 
        players={players} 
        canEdit={canEdit}
        teamSport={membership.team.sport}
        userRole={userRole}
      />
    </div>
  )
}

