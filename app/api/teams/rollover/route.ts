import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { Prisma } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamPermission } from "@/lib/rbac"
import { ROLES } from "@/lib/roles"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, seasonName, seasonStart, seasonEnd, duesAmount, duesDueDate } = await request.json()

    if (!seasonName || !seasonStart || !seasonEnd) {
      return NextResponse.json({ error: "Season name, start, and end are required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "manage_billing")

    // Get current team
    const currentTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        players: true,
        memberships: {
          where: {
            role: { in: [ROLES.HEAD_COACH, ROLES.ASSISTANT_COACH] },
          },
        },
      },
    })

    if (!currentTeam) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Create new team
    const newTeam = await prisma.team.create({
      data: {
        organizationId: currentTeam.organizationId,
        name: currentTeam.name,
        sport: currentTeam.sport,
        seasonName,
        seasonStart: new Date(seasonStart),
        seasonEnd: new Date(seasonEnd),
        rosterCap: currentTeam.rosterCap,
        duesAmount: duesAmount || currentTeam.duesAmount,
        duesDueDate: duesDueDate ? new Date(duesDueDate) : null,
      },
    })

    // Copy staff memberships
    for (const membership of currentTeam.memberships) {
      await prisma.membership.create({
        data: {
          userId: membership.userId,
          teamId: newTeam.id,
          role: membership.role,
          permissions: membership.permissions ?? Prisma.JsonNull,
        },
      })
    }

    // Copy players as inactive
    for (const player of currentTeam.players) {
      await prisma.player.create({
        data: {
          teamId: newTeam.id,
          userId: player.userId,
          firstName: player.firstName,
          lastName: player.lastName,
          grade: player.grade,
          jerseyNumber: player.jerseyNumber,
          positionGroup: player.positionGroup,
          notes: player.notes,
          status: "inactive", // Start as inactive
        },
      })
    }

    await prisma.auditLog.create({
      data: {
        teamId: newTeam.id,
        actorUserId: session.user.id,
        action: "season_rollover",
        metadata: {
          fromTeamId: teamId,
          toTeamId: newTeam.id,
          seasonName,
          playersCopied: currentTeam.players.length,
        },
      },
    })

    return NextResponse.json({ success: true, newTeamId: newTeam.id })
  } catch (error: any) {
    console.error("Season rollover error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
