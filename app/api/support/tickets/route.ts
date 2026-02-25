import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createNotifications } from "@/lib/notifications"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const teamId = typeof body.teamId === "string" ? body.teamId : ""
    const subject = typeof body.subject === "string" ? body.subject.trim() : ""
    const message = typeof body.message === "string" ? body.message.trim() : ""
    const category = typeof body.category === "string" ? body.category.trim() : null
    const priority = typeof body.priority === "string" ? body.priority.trim().toLowerCase() : "normal"

    if (!teamId || !subject || !message) {
      return NextResponse.json({ error: "teamId, subject, and message are required" }, { status: 400 })
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id, teamId },
      select: { teamId: true },
    })
    if (!membership) {
      return NextResponse.json({ error: "You are not part of that team" }, { status: 403 })
    }

    const headCoach = await prisma.membership.findFirst({
      where: { teamId, role: "HEAD_COACH" },
      select: { userId: true },
    })
    if (!headCoach) {
      return NextResponse.json({ error: "Team has no Head Coach assigned yet" }, { status: 400 })
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        teamId,
        createdByUserId: session.user.id,
        headCoachUserId: headCoach.userId,
        subject,
        originalMessage: message,
        category,
        priority,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    })

    await createNotifications({
      type: "account_status",
      teamId,
      title: "Issue received",
      body: `Your support issue "${subject}" was received.`,
      targetUserIds: [session.user.id],
      metadata: { ticketId: ticket.id, status: ticket.status },
    })

    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "support_ticket_created",
        metadata: {
          ticketId: ticket.id,
          subject,
          headCoachUserId: headCoach.userId,
        },
      },
    })

    return NextResponse.json({ success: true, ticket })
  } catch (error: any) {
    console.error("Support ticket create error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
