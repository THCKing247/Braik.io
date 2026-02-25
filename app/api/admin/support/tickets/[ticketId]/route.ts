import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminAccessForApi } from "@/lib/admin-access"
import { writeAdminAuditLog } from "@/lib/admin-audit"
import { createNotifications } from "@/lib/notifications"

const VALID_STATUSES = ["NEW", "IN_PROGRESS", "WAITING", "RESOLVED", "CLOSED"] as const

export async function PATCH(request: Request, { params }: { params: { ticketId: string } }) {
  try {
    const access = await getAdminAccessForApi()
    if (!access.ok) {
      return access.response
    }

    const body = await request.json()
    const nextStatus = typeof body.status === "string" ? body.status : null
    if (!nextStatus || !VALID_STATUSES.includes(nextStatus as any)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: params.ticketId },
      select: {
        id: true,
        status: true,
        teamId: true,
        headCoachUserId: true,
        subject: true,
      },
    })
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: {
        status: nextStatus,
        assignedAdminId: access.context.actorId,
        resolvedAt: nextStatus === "RESOLVED" ? new Date() : null,
        closedAt: nextStatus === "CLOSED" ? new Date() : null,
      },
      select: { id: true, status: true, updatedAt: true },
    })

    await createNotifications({
      type: "account_status",
      teamId: ticket.teamId,
      title: "Support ticket status updated",
      body: `Ticket "${ticket.subject}" is now ${nextStatus.toLowerCase().replace("_", " ")}.`,
      targetUserIds: [ticket.headCoachUserId],
      metadata: { ticketId: ticket.id, status: nextStatus },
    })

    await writeAdminAuditLog({
      actorId: access.context.actorId,
      action: "support_ticket_status_updated",
      targetType: "support_ticket",
      targetId: ticket.id,
      metadata: {
        from: ticket.status,
        to: nextStatus,
      },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    })

    return NextResponse.json({ success: true, ticket: updated })
  } catch (error: any) {
    console.error("Admin support ticket update error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
