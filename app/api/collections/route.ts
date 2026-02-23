import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")

    if (!teamId) {
      return NextResponse.json({ error: "Team ID required" }, { status: 400 })
    }

    // Verify user is head coach of this team
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

    // Get team and players
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: {
        players: {
          orderBy: [
            { lastName: "asc" },
            { firstName: "asc" },
          ],
        },
      },
    })

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Calculate subscription info
    const playerCount = team.players.length
    const subscriptionAmount = playerCount * 5.0
    const amountPaid = team.amountPaid || 0
    const remainingBalance = subscriptionAmount - amountPaid

    // For now, mark players as paid if team subscription is paid
    // In the future, this would track individual player payments
    const players = team.players.map((player) => ({
      id: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      jerseyNumber: player.jerseyNumber,
      subscriptionPaid: team.subscriptionPaid || false,
      paymentMethod: team.subscriptionPaid ? "card" : null,
    }))

    return NextResponse.json({
      players,
      subscriptionInfo: {
        totalAmount: subscriptionAmount,
        amountPaid,
        remainingBalance,
        subscriptionPaid: team.subscriptionPaid || false,
      },
    })
  } catch (error) {
    console.error("Collections error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
