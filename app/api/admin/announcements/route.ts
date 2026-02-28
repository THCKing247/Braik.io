import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminAccessForApi } from "@/lib/admin-access"
import { writeAdminAuditLog } from "@/lib/admin-audit"
import { createNotifications, sendPushNotifications } from "@/lib/notifications"

export async function POST(request: Request) {
  try {
    const access = await getAdminAccessForApi()
    if (!access.ok) {
      return access.response
    }

    const body = await request.json()
    const content = typeof body.content === "string" ? body.content.trim() : ""
    const filters = (body.filters && typeof body.filters === "object" ? body.filters : {}) as {
      planTier?: string
      region?: string
      sport?: string
      teamStatus?: string
      serviceStatus?: string
      teamId?: string
    }
    const normalizedTeamStatus =
      typeof filters.teamStatus === "string"
        ? filters.teamStatus
        : typeof filters.serviceStatus === "string"
          ? filters.serviceStatus.toLowerCase() === "active"
            ? "active"
            : filters.serviceStatus.toLowerCase() === "suspended"
              ? "suspended"
              : undefined
          : undefined
    if (!content) {
      return NextResponse.json({ error: "content is required" }, { status: 400 })
    }

    const targetMemberships = await prisma.membership.findMany({
      where: {
        role: "HEAD_COACH",
        team: {
          ...(filters.planTier ? { planTier: filters.planTier } : {}),
          ...(filters.region ? { region: filters.region } : {}),
          ...(filters.sport ? { sport: filters.sport } : {}),
          ...(normalizedTeamStatus ? { teamStatus: normalizedTeamStatus } : {}),
          ...(filters.teamId ? { id: filters.teamId } : {}),
        },
      },
      select: {
        userId: true,
        teamId: true,
      },
    })

    const userIds = [...new Set(targetMemberships.map((membership) => membership.userId))]
    const scope = filters.teamId ? "TEAM" : Object.keys(filters).length > 0 ? "FILTERED" : "ALL_HEAD_COACHES"

    const announcement = await prisma.adminAnnouncement.create({
      data: {
        createdByAdminId: access.context.actorId,
        teamId: filters.teamId || null,
        scope,
        headCoachOnly: true,
        content,
        filters,
      },
      select: {
        id: true,
        scope: true,
        createdAt: true,
      },
    })

    const firstTeamId = targetMemberships[0]?.teamId || filters.teamId
    if (firstTeamId && userIds.length > 0) {
      await createNotifications({
        type: "announcement",
        teamId: firstTeamId,
        title: "Braik Admin Announcement",
        body: content,
        targetUserIds: userIds,
        metadata: { adminAnnouncementId: announcement.id, filters },
      })
      await sendPushNotifications(userIds, "Braik Admin Announcement", content.slice(0, 160))
    }

    await writeAdminAuditLog({
      actorId: access.context.actorId,
      action: "admin_announcement_created",
      targetType: "admin_announcement",
      targetId: announcement.id,
      metadata: {
        scope,
        recipientCount: userIds.length,
        filters,
      },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    })

    return NextResponse.json({
      success: true,
      announcement,
      recipientCount: userIds.length,
    })
  } catch (error: any) {
    console.error("Admin announcement create error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
