import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getMessagingPermissions, getUserType } from "@/lib/messaging-permissions"

/**
 * GET /api/messages/contacts
 * Get list of contacts the user can message
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    // Get user's membership and role
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        teamId,
      },
    })

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this team" }, { status: 403 })
    }

    const userRole = membership.role as "HEAD_COACH" | "ASSISTANT_COACH" | "PLAYER" | "PARENT"
    const permissions = getMessagingPermissions(userRole)

    // Get all team members
    const teamMembers = await prisma.membership.findMany({
      where: { teamId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    })

    // Filter contacts based on permissions
    const contacts = teamMembers
      .filter(member => {
        // Don't include self
        if (member.userId === session.user.id) {
          return false
        }

        const targetRole = member.role as "HEAD_COACH" | "ASSISTANT_COACH" | "PLAYER" | "PARENT"
        const targetType = getUserType(targetRole)

        return permissions.canMessageIndividual(targetRole, targetType)
      })
      .map(member => ({
        id: member.userId,
        name: member.user.name || member.user.email,
        email: member.user.email,
        image: member.user.image,
        role: member.role,
        type: getUserType(member.role as "HEAD_COACH" | "ASSISTANT_COACH" | "PLAYER" | "PARENT"),
      }))

    return NextResponse.json(contacts)
  } catch (error: any) {
    console.error("Get contacts error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
