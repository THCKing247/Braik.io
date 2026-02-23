import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(
  request: Request,
  { params }: { params: { collectionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { teamId } = body

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

    // Update collection status
    const collection = await prisma.coachPaymentCollection.update({
      where: {
        id: params.collectionId,
        teamId: teamId,
      },
      data: {
        status: "closed",
      },
    })

    return NextResponse.json(collection)
  } catch (error) {
    console.error("Close collection error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
