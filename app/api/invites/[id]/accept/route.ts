import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ROLES } from "@/lib/roles"

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const invite = await prisma.invite.findUnique({
      where: { id: params.id },
    })

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 })
    }

    // Verify email matches
    if (invite.email !== session.user.email) {
      return NextResponse.json({ error: "Email mismatch" }, { status: 403 })
    }

    // Check if already accepted
    if (invite.acceptedAt) {
      return NextResponse.json({ error: "Invite already accepted" }, { status: 400 })
    }

    // Check if expired
    if (new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ error: "Invite expired" }, { status: 400 })
    }

    // Create membership
    await prisma.membership.create({
      data: {
        userId: session.user.id,
        teamId: invite.teamId,
        role: invite.role,
      },
    })

    // If role is PARENT, create guardian profile
    if (invite.role === ROLES.PARENT) {
      await prisma.guardian.upsert({
        where: { userId: session.user.id },
        create: {
          userId: session.user.id,
        },
        update: {},
      })
    }

    // Mark invite as accepted
    await prisma.invite.update({
      where: { id: params.id },
      data: {
        acceptedAt: new Date(),
      },
    })

    await prisma.auditLog.create({
      data: {
        teamId: invite.teamId,
        actorUserId: session.user.id,
        action: "invite_accepted",
        metadata: { inviteId: invite.id, role: invite.role },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Accept invite error:", error)
    if (error.code === "P2002") {
      return NextResponse.json({ error: "Already a member of this team" }, { status: 400 })
    }
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
