import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminAccessForApi } from "@/lib/admin-access"
import { writeAdminAuditLog } from "@/lib/admin-audit"

function mapLegacyServiceStatusToTeamStatus(value: string): string | null {
  switch (value.toUpperCase()) {
    case "ACTIVE":
      return "active"
    case "SUSPENDED":
      return "suspended"
    case "CANCELLED":
      return "cancelled"
    case "TERMINATED":
      return "terminated"
    default:
      return null
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const access = await getAdminAccessForApi()
    if (!access.ok) return access.response

    const team = await prisma.team.findUnique({
      where: { id: params.teamId },
      include: {
        organization: { select: { name: true } },
        memberships: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
        subscriptions: true,
      },
    })
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    return NextResponse.json({ team })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const access = await getAdminAccessForApi()
    if (!access.ok) return access.response

    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (typeof body.name === "string") data.name = body.name.trim()
    if (typeof body.subscriptionStatus === "string") data.subscriptionStatus = body.subscriptionStatus
    if (typeof body.teamStatus === "string") data.teamStatus = body.teamStatus
    if (typeof body.serviceStatus === "string") {
      const mapped = mapLegacyServiceStatusToTeamStatus(body.serviceStatus)
      if (mapped) {
        data.teamStatus = mapped
      }
    }
    if (typeof body.baseAiCredits === "number") data.baseAiCredits = body.baseAiCredits
    if (typeof body.aiUsageThisCycle === "number") data.aiUsageThisCycle = body.aiUsageThisCycle

    const team = await prisma.team.update({
      where: { id: params.teamId },
      data,
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        teamStatus: true,
        baseAiCredits: true,
        aiUsageThisCycle: true,
      },
    })

    await writeAdminAuditLog({
      actorId: access.context.actorId,
      action: "admin_team_updated",
      targetType: "team",
      targetId: team.id,
      metadata: { fields: Object.keys(data) },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    })

    return NextResponse.json({ success: true, team })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
