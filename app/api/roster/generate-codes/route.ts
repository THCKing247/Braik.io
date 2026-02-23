import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomBytes } from "crypto"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await request.json()

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

    // Get all players without codes
    const players = await prisma.player.findMany({
      where: {
        teamId: teamId,
        uniqueCode: null,
      },
    })

    // Generate unique codes for each player
    const updates = players.map((player) => {
      const uniqueCode = randomBytes(4).toString('hex').toUpperCase().slice(0, 8)
      return prisma.player.update({
        where: { id: player.id },
        data: { uniqueCode },
      })
    })

    await Promise.all(updates)

    return NextResponse.json({ success: true, count: updates.length })
  } catch (error) {
    console.error("Generate codes error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
