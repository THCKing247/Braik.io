import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminAccessForApi } from "@/lib/admin-access"
import { writeAdminAuditLog } from "@/lib/admin-audit"
import { createNotifications } from "@/lib/notifications"

export async function POST(request: Request, { params }: { params: { ticketId: string } }) {
  try {
    const access = await getAdminAccessForApi()
    if (!access.ok) {
      return access.response
    }

    const body = await request.json()
    const message = typeof body.message === "string" ? body.message.trim() : ""
    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 })
    }

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: params.ticketId },
      select: {
        id: true,
        teamId: true,
        headCoachUserId: true,
      },
    })
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const supportMessage = await prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        senderAdminId: access.context.actorId,
        message,
      },
      select: {
        id: true,
        createdAt: true,
      },
    })

    await createNotifications({
      type: "announcement",
      teamId: ticket.teamId,
      title: "Support reply from Braik",
      body: message,
      targetUserIds: [ticket.headCoachUserId],
      metadata: { ticketId: ticket.id },
    })

    await writeAdminAuditLog({
      actorId: access.context.actorId,
      action: "support_ticket_message_sent",
      targetType: "support_ticket",
      targetId: ticket.id,
      metadata: { supportMessageId: supportMessage.id },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    })

    return NextResponse.json({ success: true, message: supportMessage })
  } catch (error: any) {
    console.error("Admin support message error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
