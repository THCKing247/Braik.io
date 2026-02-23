import { NextResponse } from "next/server"
import { headers } from "next/headers"
import Stripe from "stripe"
import { prisma } from "@/lib/prisma"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
})

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session

    // Update payment status
    const payment = await prisma.payment.findUnique({
      where: { stripeSessionId: session.id },
    })

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "completed",
          paidAt: new Date(),
          stripePaymentIntentId: session.payment_intent as string,
        },
      })

      // Create audit log
      await prisma.auditLog.create({
        data: {
          teamId: payment.teamId,
          actorUserId: payment.guardianId || "system",
          action: "payment_received",
          metadata: {
            paymentId: payment.id,
            amount: payment.amount,
            playerId: payment.playerId,
          },
        },
      })
    }
  }

  return NextResponse.json({ received: true })
}

