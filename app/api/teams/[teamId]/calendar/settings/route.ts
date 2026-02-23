import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"

// GET /api/teams/[teamId]/calendar/settings
export async function GET(
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

    let settings = await prisma.calendarSettings.findUnique({
      where: { teamId },
    })

    // Create default settings if they don't exist
    if (!settings) {
      settings = await prisma.calendarSettings.create({
        data: {
          teamId,
        },
      })
    }

    return NextResponse.json(settings)
  } catch (error: any) {
    console.error("Get calendar settings error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

// PATCH /api/teams/[teamId]/calendar/settings
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

    // Only head coach can update calendar settings
    if (membership.role !== "HEAD_COACH") {
      return NextResponse.json(
        { error: "Only head coaches can update calendar settings" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const updateData: any = {}

    if (body.defaultView !== undefined) updateData.defaultView = body.defaultView
    if (body.assistantsCanAddMeetings !== undefined)
      updateData.assistantsCanAddMeetings = body.assistantsCanAddMeetings
    if (body.assistantsCanAddPractices !== undefined)
      updateData.assistantsCanAddPractices = body.assistantsCanAddPractices
    if (body.assistantsCanEditNonlocked !== undefined)
      updateData.assistantsCanEditNonlocked = body.assistantsCanEditNonlocked
    if (body.compactView !== undefined) updateData.compactView = body.compactView

    let settings = await prisma.calendarSettings.findUnique({
      where: { teamId },
    })

    if (!settings) {
      settings = await prisma.calendarSettings.create({
        data: {
          teamId,
          ...updateData,
        },
      })
    } else {
      settings = await prisma.calendarSettings.update({
        where: { teamId },
        data: updateData,
      })
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "calendar_settings_updated",
        metadata: { changes: body },
      },
    })

    return NextResponse.json(settings)
  } catch (error: any) {
    console.error("Update calendar settings error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
