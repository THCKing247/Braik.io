import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playerId, teamId } = await request.json()

    if (!playerId || !teamId) {
      return NextResponse.json({ error: "Player ID and Team ID required" }, { status: 400 })
    }

    // Verify user is head coach
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        teamId: teamId,
        role: "HEAD_COACH",
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Get team to update payment
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true },
    })

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Update team payment (mark $5 as paid for this player)
    const newAmountPaid = (team.amountPaid || 0) + 5.0
    const subscriptionAmount = team.players.length * 5.0
    const subscriptionPaid = newAmountPaid >= subscriptionAmount

    await prisma.team.update({
      where: { id: teamId },
      data: {
        amountPaid: newAmountPaid,
        subscriptionPaid: subscriptionPaid,
      },
    })

    return NextResponse.json({ success: true, amountPaid: newAmountPaid, subscriptionPaid })
  } catch (error) {
    console.error("Mark cash payment error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
