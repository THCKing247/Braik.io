import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserMembership } from "@/lib/rbac"

// GET /api/teams/[teamId]/payments/coach/transactions
export async function GET(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = params
    const membership = await getUserMembership(teamId)
    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only coaches can view all transactions
    if (membership.role !== "HEAD_COACH" && membership.role !== "ASSISTANT_COACH") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const collectionId = searchParams.get("collectionId")
    const status = searchParams.get("status")

    const where: any = {
      collection: {
        teamId,
      },
    }

    if (collectionId) {
      where.collectionId = collectionId
    }

    if (status) {
      where.status = status
    }

    const transactions = await prisma.coachPaymentTransaction.findMany({
      where,
      include: {
        collection: {
          select: {
            id: true,
            title: true,
            amount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(transactions)
  } catch (error: any) {
    console.error("Get transactions error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
