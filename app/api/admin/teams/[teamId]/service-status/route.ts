import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminAccessForApi } from "@/lib/admin-access"
import { writeAdminAuditLog } from "@/lib/admin-audit"
import { createNotifications } from "@/lib/notifications"

const VALID_SERVICE_STATUSES = ["ACTIVE", "PAST_DUE", "SUSPENDED"] as const

export async function PATCH(request: Request, { params }: { params: { teamId: string } }) {
  try {
    const access = await getAdminAccessForApi()
    if (!access.ok) {
      return access.response
    }

    const body = await request.json()
    const nextStatus = typeof body.serviceStatus === "string" ? body.serviceStatus : null
    if (!nextStatus || !VALID_SERVICE_STATUSES.includes(nextStatus as any)) {
      return NextResponse.json({ error: "serviceStatus must be ACTIVE, PAST_DUE, or SUSPENDED" }, { status: 400 })
    }

    const team = await prisma.team.findUnique({
      where: { id: params.teamId },
      select: {
        id: true,
        name: true,
        serviceStatus: true,
        memberships: {
          where: { role: "HEAD_COACH" },
          select: { userId: true },
        },
      },
    })
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const updated = await prisma.team.update({
      where: { id: team.id },
      data: { serviceStatus: nextStatus },
      select: { id: true, name: true, serviceStatus: true, updatedAt: true },
    })

    await createNotifications({
      type: "account_status",
      teamId: team.id,
      title: "Team service status updated",
      body: `${team.name} is now ${nextStatus.replace("_", " ").toLowerCase()}.`,
      targetUserIds: team.memberships.map((membership) => membership.userId),
      metadata: { previousStatus: team.serviceStatus, nextStatus },
    })

    await writeAdminAuditLog({
      actorId: access.context.actorId,
      action: "team_service_status_updated",
      targetType: "team",
      targetId: team.id,
      metadata: {
        previousStatus: team.serviceStatus,
        nextStatus,
      },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    })

    return NextResponse.json({ success: true, team: updated })
  } catch (error: any) {
    console.error("Admin team service status update error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
