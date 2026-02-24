import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"
import { Prisma } from "@prisma/client"

// PATCH /api/teams/[teamId]/memberships/[membershipId]
// Update assistant coach position groups
export async function PATCH(
  request: Request,
  { params }: { params: { teamId: string; membershipId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, membershipId } = params
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only head coach can update memberships
    if (membership.role !== "HEAD_COACH") {
      return NextResponse.json(
        { error: "Only head coaches can update memberships" },
        { status: 403 }
      )
    }

    const targetMembership = await prisma.membership.findUnique({
      where: { id: membershipId },
    })

    if (!targetMembership || targetMembership.teamId !== teamId) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 })
    }

    // Only allow updating position groups for assistant coaches
    if (targetMembership.role !== "ASSISTANT_COACH") {
      return NextResponse.json(
        { error: "Position groups can only be set for assistant coaches" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { positionGroups } = body

    if (!Array.isArray(positionGroups)) {
      return NextResponse.json(
        { error: "Position groups must be an array" },
        { status: 400 }
      )
    }

    const updated = await prisma.membership.update({
      where: { id: membershipId },
      data: {
        positionGroups: positionGroups.length > 0 ? positionGroups : Prisma.JsonNull,
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "membership_updated",
        metadata: {
          membershipId,
          positionGroups,
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    console.error("Update membership error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
