import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamPermission } from "@/lib/rbac"

/**
 * GET /api/roster/depth-chart/position-labels
 * Get custom position labels for depth chart (all roles can view)
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

    // Check if user has access to this team
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        teamId: teamId,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get all custom position labels for this team
    const labels = await prisma.depthChartPositionLabel.findMany({
      where: { teamId },
    })

    // Convert to a map for easy lookup: { unit-position-specialTeamType: customLabel }
    const labelMap: Record<string, string> = {}
    labels.forEach((label) => {
      const key = label.specialTeamType
        ? `${label.unit}-${label.position}-${label.specialTeamType}`
        : `${label.unit}-${label.position}`
      labelMap[key] = label.customLabel
    })

    return NextResponse.json({ labels: labelMap })
  } catch (error: any) {
    console.error("Get position labels error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/roster/depth-chart/position-labels
 * Update custom position labels (Head Coach only)
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, labels } = await request.json()

    if (!teamId) {
      return NextResponse.json({ error: "Team ID required" }, { status: 400 })
    }

    if (!Array.isArray(labels)) {
      return NextResponse.json({ error: "Labels must be an array" }, { status: 400 })
    }

    // Only Head Coach can edit position labels
    await requireTeamPermission(teamId, "manage")

    // Validate each label
    for (const label of labels) {
      const { unit, position, customLabel, specialTeamType } = label

      if (!unit || !position || !customLabel) {
        return NextResponse.json(
          { error: "Each label must have unit, position, and customLabel" },
          { status: 400 }
        )
      }

      // Validate unit
      if (!["offense", "defense", "special_teams"].includes(unit)) {
        return NextResponse.json(
          { error: `Invalid unit: ${unit}` },
          { status: 400 }
        )
      }

      // If special_teams, specialTeamType is required
      if (unit === "special_teams" && !specialTeamType) {
        return NextResponse.json(
          { error: "specialTeamType is required for special_teams unit" },
          { status: 400 }
        )
      }
    }

    // Process updates in a transaction
    const results = await prisma.$transaction(
      labels.map((label: any) =>
        prisma.depthChartPositionLabel.upsert({
          where: {
            teamId_unit_position_specialTeamType: {
              teamId,
              unit: label.unit,
              position: label.position,
              specialTeamType: label.specialTeamType || null,
            },
          },
          update: {
            customLabel: label.customLabel,
          },
          create: {
            teamId,
            unit: label.unit,
            position: label.position,
            customLabel: label.customLabel,
            specialTeamType: label.specialTeamType || null,
          },
        })
      )
    )

    // Create audit log
    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "depth_chart_labels_updated",
        metadata: { labelsCount: labels.length },
      },
    })

    return NextResponse.json({ success: true, labels: results })
  } catch (error: any) {
    console.error("Update position labels error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
