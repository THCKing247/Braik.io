import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamPermission } from "@/lib/rbac"
import { requireBillingPermission } from "@/lib/billing-state"
import { randomBytes } from "crypto"
import { ensureProgramCodes } from "@/lib/program-codes"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, firstName, lastName, grade, jerseyNumber, positionGroup, email, notes } = await request.json()

    await requireTeamPermission(teamId, "edit_roster")
    
    // Check billing state - read-only mode blocks roster modifications
    await requireBillingPermission(teamId, "modify", prisma)

    // Check roster cap
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { _count: { select: { players: true } } },
    })

    if (team && team._count.players >= team.rosterCap) {
      return NextResponse.json(
        { error: "Roster cap reached" },
        { status: 400 }
      )
    }

    // Find or create user if email provided
    let userId = null
    if (email) {
      let user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        // Create user without password - they'll set it via invite
        user = await prisma.user.create({
          data: { email, name: `${firstName} ${lastName}` },
        })
      }
      userId = user.id
    }

    // Ensure team has program team codes
    await ensureProgramCodes(teamId)

    // Generate unique code for player
    const uniqueCode = randomBytes(4).toString('hex').toUpperCase().slice(0, 8)

    const player = await prisma.player.create({
      data: {
        teamId,
        userId,
        firstName,
        lastName,
        grade: grade ? parseInt(grade) : null,
        jerseyNumber: jerseyNumber ? parseInt(jerseyNumber) : null,
        positionGroup: positionGroup || null,
        notes: notes || null,
        status: "active",
        uniqueCode: uniqueCode,
      },
      include: {
        user: true,
        guardianLinks: {
          include: {
            guardian: {
              include: { user: true },
            },
          },
        },
      },
    })

    // Create membership if user exists
    if (userId) {
      await prisma.membership.create({
        data: {
          userId,
          teamId,
          role: "PLAYER",
        },
      })
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "player_added",
        metadata: { playerId: player.id, playerName: `${firstName} ${lastName}` },
      },
    })

    return NextResponse.json(player)
  } catch (error: any) {
    console.error("Roster error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

