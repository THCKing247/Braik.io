import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  request: Request,
  { params }: { params: { collectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const collectionType = searchParams.get("type")

    if (!teamId) {
      return NextResponse.json({ error: "Team ID required" }, { status: 400 })
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

    if (collectionType === "roster-dues") {
      // Handle roster dues collection
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
          players: {
            select: {
              id: true,
            },
          },
        },
      })

      if (!team) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 })
      }

      const playerCount = team.players.length
      const totalAmount = team.duesAmount * playerCount
      const totalCollected = team.amountPaid || 0
      const totalRemaining = totalAmount - totalCollected

      return NextResponse.json({
        id: "roster-dues",
        title: "Roster Dues",
        description: "Per-player subscription payments",
        amount: totalAmount,
        status: team.subscriptionPaid ? "closed" : "open",
        totalCollected,
        totalRemaining,
        playerCount,
      })
    } else {
      // Handle custom collection
      const collection = await prisma.coachPaymentCollection.findFirst({
        where: {
          id: params.collectionId,
          teamId: teamId,
        },
        include: {
          transactions: {
            where: {
              status: "completed",
            },
          },
        },
      })

      if (!collection) {
        return NextResponse.json({ error: "Collection not found" }, { status: 404 })
      }

      const totalCollected = collection.transactions.reduce(
        (sum, t) => sum + t.amount,
        0
      )
      const totalRemaining = collection.amount - totalCollected

      return NextResponse.json({
        id: collection.id,
        title: collection.title,
        description: collection.description,
        amount: collection.amount,
        status: collection.status,
        totalCollected,
        totalRemaining,
      })
    }
  } catch (error) {
    console.error("Get collection error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
