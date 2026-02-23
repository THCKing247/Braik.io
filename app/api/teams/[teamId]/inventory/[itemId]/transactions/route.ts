import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"
import { getInventoryPermissions } from "@/lib/inventory-permissions"

// GET /api/teams/[teamId]/inventory/[itemId]/transactions
// Get transaction history for an inventory item
export async function GET(
  request: Request,
  { params }: { params: { teamId: string; itemId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, itemId } = params
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const permissions = await getInventoryPermissions(
      {
        userId: membership.userId,
        role: membership.role,
        permissions: membership.permissions,
        positionGroups: membership.permissions?.positionGroups,
      },
      teamId
    )

    if (!permissions.canView) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Verify the item exists and belongs to the team
    const item = await prisma.inventoryItem.findUnique({
      where: { id: itemId },
      select: { id: true, teamId: true },
    })

    if (!item || item.teamId !== teamId) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        inventoryItemId: itemId,
        teamId,
      },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jerseyNumber: true,
          },
        },
        performedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(transactions)
  } catch (error: any) {
    console.error("Get inventory transactions error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
