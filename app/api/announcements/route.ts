import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamPermission } from "@/lib/rbac"
import { createNotifications } from "@/lib/notifications"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, title, body, audience } = await request.json()

    await requireTeamPermission(teamId, "post_announcements")

    const announcement = await prisma.announcement.create({
      data: {
        teamId,
        title,
        body,
        audience: audience || "all",
        createdBy: session.user.id,
      },
      include: {
        creator: { select: { name: true, email: true } },
      },
    })

    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "announcement_created",
        metadata: { announcementId: announcement.id, title },
      },
    })

    // Create notifications for announcement (exclude creator)
    await createNotifications({
      type: "announcement",
      teamId,
      title: `New announcement: ${title}`,
      body: body?.substring(0, 200) || title, // Preview
      linkUrl: `/dashboard/announcements`,
      linkType: "announcement",
      linkId: announcement.id,
      metadata: {
        announcementId: announcement.id,
        audience: announcement.audience,
      },
      excludeUserIds: [session.user.id], // Don't notify the creator
    })

    return NextResponse.json(announcement)
  } catch (error: any) {
    console.error("Announcement error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

