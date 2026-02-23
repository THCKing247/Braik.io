import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
})

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, playerId } = await request.json()

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

    // Create Stripe checkout session
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 500 })
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Team Dues - ${player.firstName} ${player.lastName}`,
              description: `${team.name} - ${team.seasonName}`,
            },
            unit_amount: Math.round(team.duesAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXTAUTH_URL}/dashboard/payments?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/payments?canceled=true`,
      metadata: {
        teamId,
        playerId,
        userId: session.user.id,
      },
    })

    // Create payment record
    await prisma.payment.create({
      data: {
        teamId,
        playerId,
        guardianId: player.guardianLinks[0]?.guardianId || null,
        amount: team.duesAmount,
        stripeSessionId: checkoutSession.id,
        status: "pending",
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error: any) {
    console.error("Checkout error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

