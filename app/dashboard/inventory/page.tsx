import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"
import { getInventoryPermissions } from "@/lib/inventory-permissions"
import { InventoryManager } from "@/components/inventory-manager"

export default async function InventoryPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || !session?.user?.role || !session?.user?.teamId) {
    redirect("/login")
  }

  const teamId = session.user.teamId
  const membership = await getUserMembership(teamId)

  if (!membership) {
    redirect("/dashboard")
  }

  // Get permissions
  const permissions = await getInventoryPermissions(
    {
      userId: membership.userId,
      role: membership.role,
      permissions: membership.permissions,
      positionGroups: membership.permissions?.positionGroups,
    },
    teamId
  )

  // Parents have no access
  if (!permissions.canView) {
    redirect("/dashboard")
  }

  // Build where clause based on permissions
  const where: any = { teamId }
  if (!permissions.canViewAll && permissions.scopedPlayerIds) {
    if (permissions.scopedPlayerIds.length === 0) {
      // Player with no assigned items - show empty list
      return (
        <div>
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2" style={{ color: "#111827" }}>My Equipment</h1>
            <p style={{ color: "#6B7280" }}>Items assigned to you</p>
          </div>
          <InventoryManager
            teamId={teamId}
            initialItems={[]}
            players={[]}
            permissions={permissions}
          />
        </div>
      )
    }
    // For coordinators/position coaches: show items assigned to their players OR unassigned items
    // For players: only show items assigned to them
    if (membership.role === "PLAYER") {
      where.assignedToPlayerId = { in: permissions.scopedPlayerIds }
    } else {
      // Coordinators and position coaches can see unassigned items + items assigned to their players
      where.OR = [
        { assignedToPlayerId: { in: permissions.scopedPlayerIds } },
        { assignedToPlayerId: null },
      ]
    }
  }

  // Get inventory items
  const items = await prisma.inventoryItem.findMany({
    where,
    include: {
      assignedPlayer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          jerseyNumber: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // Get players for assignment dropdown (only if user can assign)
  let players: any[] = []
  if (permissions.canAssign) {
    // Get scoped players if user can't assign to all
    const playerWhere: any = { teamId, status: "active" }
    if (permissions.scopedPlayerIds && permissions.scopedPlayerIds.length > 0) {
      playerWhere.id = { in: permissions.scopedPlayerIds }
    }

    players = await prisma.player.findMany({
      where: playerWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jerseyNumber: true,
      },
      orderBy: { lastName: "asc" },
    })
  }

  const pageTitle = membership.role === "PLAYER" ? "My Equipment" : "Inventory Management"
  const pageDescription =
    membership.role === "PLAYER"
      ? "Items assigned to you"
      : "Track equipment, uniforms, and gear"

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2" style={{ color: "#111827" }}>{pageTitle}</h1>
        <p style={{ color: "#6B7280" }}>{pageDescription}</p>
      </div>
      <InventoryManager
        teamId={teamId}
        initialItems={items}
        players={players}
        permissions={permissions}
      />
    </div>
  )
}
