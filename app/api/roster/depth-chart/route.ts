import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"
import { canViewDepthChart } from "@/lib/depth-chart-permissions"
import { requireBillingPermission } from "@/lib/billing-state"
import { TeamOperationBlockedError, requireTeamOperationAccess, toStructuredTeamAccessError } from "@/lib/team-operation-guard"

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

    // Check if user has access to this team
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // All roles can view depth charts (read-only for players/parents)
    if (!canViewDepthChart(membership)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get depth chart entries with player data
    const entries = await prisma.depthChartEntry.findMany({
      where: { teamId },
      include: {
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            jerseyNumber: true,
            positionGroup: true,
            status: true,
            imageUrl: true,
          },
        },
      },
      orderBy: [
        { unit: "asc" },
        { specialTeamType: "asc" },
        { position: "asc" },
        { string: "asc" },
      ],
    })

    return NextResponse.json({ entries })
  } catch (error: any) {
    console.error("Depth chart GET error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, entries } = await request.json()

    if (!teamId) {
      return NextResponse.json({ error: "Team ID required" }, { status: 400 })
    }

    if (!Array.isArray(entries)) {
      return NextResponse.json({ error: "Entries must be an array" }, { status: 400 })
    }

    // Get membership with full details
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Check billing state - read-only mode blocks depth chart edits
    await requireBillingPermission(teamId, "editDepthCharts", prisma)
    await requireTeamOperationAccess(teamId, "write", prisma)

    // Get full membership details for permission checks
    const fullMembership = await prisma.membership.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId: teamId,
        },
      },
    })

    if (!fullMembership) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 })
    }

    // Import depth chart permission utilities
    const {
      canEditDepthChartUnit,
      canEditDepthChartPosition,
      validatePlayerInRoster,
    } = await import("@/lib/depth-chart-permissions")

    // Validate each entry and check permissions
    const validatedEntries: Array<{
      unit: string
      position: string
      string: number
      playerId: string | null
      specialTeamType?: string | null
    }> = []

    for (const entry of entries) {
      const { unit, position, string, playerId, specialTeamType } = entry

      // Validate required fields
      if (!unit || !position || !string) {
        return NextResponse.json(
          { error: "Each entry must have unit, position, and string" },
          { status: 400 }
        )
      }

      // Check unit-level permission
      if (!canEditDepthChartUnit(fullMembership, unit)) {
        const { logPermissionDenial } = await import("@/lib/structured-logger")
        logPermissionDenial({
          userId: session.user.id,
          teamId,
          role: fullMembership.role,
          reason: `Insufficient permissions to edit ${unit} depth charts`,
        })
        return NextResponse.json(
          { error: `You do not have permission to edit ${unit} depth charts` },
          { status: 403 }
        )
      }

      // Check position-level permission (for position coaches)
      if (!canEditDepthChartPosition(fullMembership, unit, position)) {
        const { logPermissionDenial } = await import("@/lib/structured-logger")
        logPermissionDenial({
          userId: session.user.id,
          teamId,
          role: fullMembership.role,
          reason: `Insufficient permissions to edit ${position} position in ${unit}`,
        })
        return NextResponse.json(
          { error: `You do not have permission to edit ${position} position in ${unit}` },
          { status: 403 }
        )
      }

      // Validate player is in roster (if playerId is provided)
      if (playerId) {
        const isValid = await validatePlayerInRoster(teamId, playerId)
        if (!isValid) {
          return NextResponse.json(
            { error: `Player ${playerId} is not in the team roster or is inactive` },
            { status: 400 }
          )
        }
      }

      validatedEntries.push({
        unit,
        position,
        string,
        playerId: playerId || null,
        specialTeamType: specialTeamType || null,
      })
    }

    // Process updates in a transaction
    // First, delete existing entries that are being updated
    const positionsToUpdate = validatedEntries.map((e) => ({
      unit: e.unit,
      position: e.position,
      string: e.string,
      specialTeamType: e.specialTeamType || null,
    }))
    
    await prisma.depthChartEntry.deleteMany({
      where: {
        teamId,
        OR: positionsToUpdate.map((p) => ({
          unit: p.unit,
          position: p.position,
          string: p.string,
          specialTeamType: p.specialTeamType,
        })),
      },
    })

    // Then create new entries (only for non-null playerIds)
    const entriesToCreate = validatedEntries.filter((e) => e.playerId !== null)
    
    const results = await prisma.$transaction(
      entriesToCreate.map((entry) =>
        prisma.depthChartEntry.create({
          data: {
            teamId,
            unit: entry.unit,
            position: entry.position,
            string: entry.string,
            playerId: entry.playerId!,
            specialTeamType: entry.specialTeamType || null,
          },
        })
      )
    )

    // Create audit log
    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "depth_chart_updated",
        metadata: { entriesCount: validatedEntries.length },
      },
    })

    // Log depth chart edit
    const { logDepthChartEdit } = await import("@/lib/structured-logger")
    const units = [...new Set(validatedEntries.map(e => e.unit))]
    const positions = [...new Set(validatedEntries.map(e => e.position))]
    logDepthChartEdit({
      userId: session.user.id,
      teamId,
      role: fullMembership.role,
      entriesCount: validatedEntries.length,
      unit: units.length === 1 ? units[0] : undefined,
      position: positions.length === 1 ? positions[0] : undefined,
    })

    return NextResponse.json({ success: true, entries: results })
  } catch (error: any) {
    if (error instanceof TeamOperationBlockedError) {
      return NextResponse.json(toStructuredTeamAccessError(error), { status: error.statusCode })
    }
    console.error("Depth chart POST error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
