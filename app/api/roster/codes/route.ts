import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamPermission } from "@/lib/rbac"

/**
 * GET /api/roster/codes
 * Get program codes (player code and parent code) with hierarchy-based visibility
 * - Head Coach: Can see both codes
 * - Coordinators: Can see both codes
 * - Position Coaches: Can see both codes
 * - Players: Cannot see codes
 * - Parents: Cannot see codes
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")

    if (!teamId) {
      return NextResponse.json({ error: "Team ID required" }, { status: 400 })
    }

    // Check if user has access to view codes (coaches only)
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        teamId: teamId,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only coaches can see codes
    const canViewCodes = ["HEAD_COACH", "ASSISTANT_COACH"].includes(membership.role)

    if (!canViewCodes) {
      return NextResponse.json({ error: "Access denied: Only coaches can view program codes" }, { status: 403 })
    }

    // Get team with codes
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        playerCode: true,
        parentCode: true,
        teamIdCode: true,
      },
    })

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    return NextResponse.json({
      playerCode: team.playerCode || null,
      parentCode: team.parentCode || null,
      teamIdCode: team.teamIdCode || null, // For backward compatibility
    })
  } catch (error: any) {
    console.error("Get codes error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
