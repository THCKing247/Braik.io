import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"

// PATCH /api/teams/[teamId]
export async function PATCH(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = params
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only head coach can update team identity
    if (membership.role !== "HEAD_COACH") {
      return NextResponse.json(
        { error: "Only head coaches can update team identity" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const updateData: any = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.slogan !== undefined) updateData.slogan = body.slogan || null
    if (body.logoUrl !== undefined) updateData.logoUrl = body.logoUrl || null
    if (body.primaryColor !== undefined) updateData.primaryColor = body.primaryColor || null
    if (body.secondaryColor !== undefined) updateData.secondaryColor = body.secondaryColor || null
    if (body.rosterCap !== undefined) updateData.rosterCap = parseInt(body.rosterCap)
    if (body.duesAmount !== undefined) updateData.duesAmount = parseFloat(body.duesAmount)
    if (body.duesDueDate !== undefined) {
      updateData.duesDueDate = body.duesDueDate ? new Date(body.duesDueDate) : null
    }

    const team = await prisma.team.update({
      where: { id: teamId },
      data: updateData,
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "team_identity_updated",
        metadata: { changes: body },
      },
    })

    return NextResponse.json(team)
  } catch (error: any) {
    console.error("Update team error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
