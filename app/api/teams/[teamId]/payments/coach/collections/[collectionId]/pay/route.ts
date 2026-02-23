import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"

// POST /api/teams/[teamId]/payments/coach/collections/[collectionId]/pay
// This handles payment processing for a collection
export async function POST(
  request: Request,
  { params }: { params: { teamId: string; collectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, collectionId } = params
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const collection = await prisma.coachPaymentCollection.findUnique({
      where: { id: collectionId },
    })

    if (!collection || collection.teamId !== teamId) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 })
    }

    if (collection.status !== "open") {
      return NextResponse.json(
        { error: "This collection is no longer accepting payments" },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { playerId } = body

    // For parents, verify they're linked to the player
    if (membership.role === "PARENT" && playerId) {
      const guardian = await prisma.guardian.findFirst({
        where: { userId: session.user.id },
        include: {
          playerLinks: {
            where: { playerId },
          },
        },
      })

      if (!guardian || guardian.playerLinks.length === 0) {
        return NextResponse.json(
          { error: "You are not authorized to pay for this player" },
          { status: 403 }
        )
      }
    }

    // In a real implementation, this would:
    // 1. Create a payment intent with Stripe Connect
    // 2. Process the payment
    // 3. Create a transaction record
    // For now, we'll create a placeholder transaction

    const transaction = await prisma.coachPaymentTransaction.create({
      data: {
        collectionId: collection.id,
        payerUserId: session.user.id,
        payerPlayerId: playerId || null,
        amount: collection.amount,
        status: "completed", // In production, this would be "pending" until confirmed
        paidAt: new Date(),
      },
    })

    // Audit log
    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "coach_payment_made",
        metadata: {
          collectionId: collection.id,
          transactionId: transaction.id,
          amount: collection.amount,
        },
      },
    })

    return NextResponse.json({
      transaction,
      message: "Payment processed successfully",
    })
  } catch (error: any) {
    console.error("Process payment error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
