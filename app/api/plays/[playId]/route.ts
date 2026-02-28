import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamAccess } from "@/lib/rbac"
import { TeamOperationBlockedError, requireTeamOperationAccess, toStructuredTeamAccessError } from "@/lib/team-operation-guard"

// GET /api/plays/[playId]
export async function GET(
  request: Request,
  { params }: { params: { playId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const play = await prisma.play.findUnique({
      where: { id: params.playId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        team: true,
      },
    })

    if (!play) {
      return NextResponse.json({ error: "Play not found" }, { status: 404 })
    }

    const { membership } = await requireTeamAccess(play.teamId)
    await requireTeamOperationAccess(play.teamId, "write", prisma)

    // Check view permissions (same logic as GET /api/plays)
    const canViewAll = membership.role === "HEAD_COACH"
    const canViewOffense =
      membership.role === "HEAD_COACH" ||
      (membership.role === "ASSISTANT_COACH" &&
        (membership.permissions as any)?.coordinatorType === "OFFENSIVE_COORDINATOR")
    const canViewDefense =
      membership.role === "HEAD_COACH" ||
      (membership.role === "ASSISTANT_COACH" &&
        (membership.permissions as any)?.coordinatorType === "DEFENSIVE_COORDINATOR")
    const canViewSpecialTeams =
      membership.role === "HEAD_COACH" ||
      (membership.role === "ASSISTANT_COACH" &&
        (membership.permissions as any)?.coordinatorType === "SPECIAL_TEAMS_COORDINATOR")

    if (
      !canViewAll &&
      !(
        (play.side === "offense" && canViewOffense) ||
        (play.side === "defense" && canViewDefense) ||
        (play.side === "special_teams" && canViewSpecialTeams)
      )
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    return NextResponse.json(play)
  } catch (error: any) {
    console.error("Get play error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

// PATCH /api/plays/[playId]
export async function PATCH(
  request: Request,
  { params }: { params: { playId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const play = await prisma.play.findUnique({
      where: { id: params.playId },
      include: { team: true },
    })

    if (!play) {
      return NextResponse.json({ error: "Play not found" }, { status: 404 })
    }

    const { membership } = await requireTeamAccess(play.teamId)

    // Check edit permissions
    const canEditAll = membership.role === "HEAD_COACH"
    const canEditOffense =
      membership.role === "HEAD_COACH" ||
      (membership.role === "ASSISTANT_COACH" &&
        (membership.permissions as any)?.coordinatorType === "OFFENSIVE_COORDINATOR")
    const canEditDefense =
      membership.role === "HEAD_COACH" ||
      (membership.role === "ASSISTANT_COACH" &&
        (membership.permissions as any)?.coordinatorType === "DEFENSIVE_COORDINATOR")
    const canEditSpecialTeams =
      membership.role === "HEAD_COACH" ||
      (membership.role === "ASSISTANT_COACH" &&
        (membership.permissions as any)?.coordinatorType === "SPECIAL_TEAMS_COORDINATOR")

    if (
      !canEditAll &&
      !(
        (play.side === "offense" && canEditOffense) ||
        (play.side === "defense" && canEditDefense) ||
        (play.side === "special_teams" && canEditSpecialTeams)
      )
    ) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const updateData: any = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.formation !== undefined) updateData.formation = body.formation
    if (body.subcategory !== undefined) updateData.subcategory = body.subcategory
    if (body.canvasData !== undefined) updateData.canvasData = body.canvasData
    if (body.side !== undefined) updateData.side = body.side

    const updated = await prisma.play.update({
      where: { id: params.playId },
      data: updateData,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error: any) {
    if (error instanceof TeamOperationBlockedError) {
      return NextResponse.json(toStructuredTeamAccessError(error), { status: error.statusCode })
    }
    console.error("Update play error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE /api/plays/[playId]
export async function DELETE(
  request: Request,
  { params }: { params: { playId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const play = await prisma.play.findUnique({
      where: { id: params.playId },
      include: { team: true },
    })

    if (!play) {
      return NextResponse.json({ error: "Play not found" }, { status: 404 })
    }

    const { membership } = await requireTeamAccess(play.teamId)
    await requireTeamOperationAccess(play.teamId, "write", prisma)

    // Only Head Coach can delete
    if (membership.role !== "HEAD_COACH") {
      return NextResponse.json({ error: "Only Head Coach can delete plays" }, { status: 403 })
    }

    await prisma.play.delete({
      where: { id: params.playId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error instanceof TeamOperationBlockedError) {
      return NextResponse.json(toStructuredTeamAccessError(error), { status: error.statusCode })
    }
    console.error("Delete play error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
