import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamPermission } from "@/lib/rbac"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, playerId } = await request.json()

    await requireTeamPermission(teamId, "manage_billing")

    const team = await prisma.team.findUnique({ where: { id: teamId } })
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        guardianLinks: {
          include: {
            guardian: { include: { user: true } },
          },
        },
      },
    })

    if (!team || !player) {
      return NextResponse.json({ error: "Team or player not found" }, { status: 404 })
    }

    // Check if already paid
    const existingPayment = await prisma.payment.findFirst({
      where: {
        teamId,
        playerId,
        status: "completed",
      },
    })

    if (existingPayment) {
      return NextResponse.json({ error: "Payment already completed" }, { status: 400 })
    }

    // Create manual payment record
    const payment = await prisma.payment.create({
      data: {
        teamId,
        playerId,
        guardianId: player.guardianLinks[0]?.guardianId || null,
        amount: team.duesAmount,
        status: "completed",
        paidAt: new Date(),
      },
    })

    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "payment_marked_paid",
        metadata: {
          paymentId: payment.id,
          amount: payment.amount,
          playerId,
          method: "manual",
        },
      },
    })

    return NextResponse.json({ success: true, payment })
  } catch (error: any) {
    console.error("Mark paid error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
