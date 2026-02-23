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

    const { teamId, amount, type } = await request.json()

    if (!teamId || !amount) {
      return NextResponse.json({ error: "Team ID and amount required" }, { status: 400 })
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

    // Get team
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true },
    })

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // For now, just update the payment amount
    // In the future, this would create a Stripe checkout session
    const currentAmountPaid = team.amountPaid || 0
    const newAmountPaid = type === "full" ? amount : currentAmountPaid + amount
    const subscriptionAmount = team.players.length * 5.0
    const subscriptionPaid = newAmountPaid >= subscriptionAmount

    await prisma.team.update({
      where: { id: teamId },
      data: {
        amountPaid: newAmountPaid,
        subscriptionPaid: subscriptionPaid,
      },
    })

    // TODO: Integrate with Stripe
    // For now, return success (in production, this would redirect to Stripe checkout)
    return NextResponse.json({ 
      success: true, 
      amountPaid: newAmountPaid,
      subscriptionPaid,
      message: "Payment processing will be integrated with Stripe soon"
    })
  } catch (error) {
    console.error("Pay card error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
