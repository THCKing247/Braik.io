import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamAccess } from "@/lib/rbac"

// GET /api/plays?teamId=xxx
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")

    if (!teamId) {
      return NextResponse.json({ error: "teamId required" }, { status: 400 })
    }

    const { membership } = await requireTeamAccess(teamId)

    // Check permissions based on role
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

    // Build where clause based on permissions
    const where: any = { teamId }
    if (!canViewAll) {
      const allowedSides: string[] = []
      if (canViewOffense) allowedSides.push("offense")
      if (canViewDefense) allowedSides.push("defense")
      if (canViewSpecialTeams) allowedSides.push("special_teams")

      if (allowedSides.length === 0) {
        // Position coach or player - view only
        return NextResponse.json([])
      }
      where.side = { in: allowedSides }
    }

    const plays = await prisma.play.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { side: "asc" },
        { formation: "asc" },
        { name: "asc" },
      ],
    })

    return NextResponse.json(plays)
  } catch (error: any) {
    console.error("Get plays error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/plays
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { teamId, side, formation, subcategory, name, canvasData } = body

    if (!teamId || !side || !formation || !name || !canvasData) {
      return NextResponse.json(
        { error: "teamId, side, formation, name, and canvasData are required" },
        { status: 400 }
      )
    }

    const { membership } = await requireTeamAccess(teamId)

    // Check permissions
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
        (side === "offense" && canEditOffense) ||
        (side === "defense" && canEditDefense) ||
        (side === "special_teams" && canEditSpecialTeams)
      )
    ) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const play = await prisma.play.create({
      data: {
        teamId,
        side,
        formation,
        subcategory: subcategory || null,
        name,
        canvasData,
        createdBy: session.user.id,
      },
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

    return NextResponse.json(play)
  } catch (error: any) {
    console.error("Create play error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
