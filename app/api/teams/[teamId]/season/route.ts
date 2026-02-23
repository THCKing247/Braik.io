import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"

// GET /api/teams/[teamId]/season - Get current season info
export async function GET(
  request: NextRequest,
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

    // Get current season (most recent)
    const currentSeason = await prisma.season.findFirst({
      where: { teamId },
      orderBy: { year: "desc" },
    })

    if (!currentSeason) {
      return NextResponse.json({
        season: null,
        message: "No season found for this team",
      })
    }

    return NextResponse.json({ season: currentSeason })
  } catch (error: any) {
    console.error("Error fetching season:", error)
    return NextResponse.json(
      { error: "Failed to fetch season" },
      { status: 500 }
    )
  }
}

// PATCH /api/teams/[teamId]/season - Update season division/standing (Head Coach only)
export async function PATCH(
  request: NextRequest,
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

    // Only head coach can update season info
    if (membership.role !== "HEAD_COACH") {
      return NextResponse.json(
        { error: "Only head coaches can update season information" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const updateData: any = {}

    if (body.division !== undefined) updateData.division = body.division || null
    if (body.conference !== undefined) updateData.conference = body.conference || null
    if (body.playoffRuleset !== undefined) updateData.playoffRuleset = body.playoffRuleset || null

    // Get or create current season
    let currentSeason = await prisma.season.findFirst({
      where: { teamId },
      orderBy: { year: "desc" },
    })

    if (!currentSeason) {
      // Create a new season if none exists
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { seasonName: true },
      })

      const currentYear = new Date().getFullYear()
      currentSeason = await prisma.season.create({
        data: {
          teamId,
          year: currentYear,
          division: updateData.division || null,
          conference: updateData.conference || null,
          playoffRuleset: updateData.playoffRuleset || null,
        },
      })
    } else {
      // Update existing season
      currentSeason = await prisma.season.update({
        where: { id: currentSeason.id },
        data: updateData,
      })
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "season_info_updated",
        metadata: { changes: body },
      },
    })

    return NextResponse.json({ season: currentSeason })
  } catch (error: any) {
    console.error("Error updating season:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update season" },
      { status: 500 }
    )
  }
}
