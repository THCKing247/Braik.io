import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamPermission } from "@/lib/rbac"
import crypto from "crypto"
import { requireTeamServiceWriteAccess } from "@/lib/team-service-status"
import { auditImpersonatedActionFromRequest } from "@/lib/impersonation"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, email, role } = await request.json()

    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "edit_roster")
    await requireTeamServiceWriteAccess(teamId, prisma)
    await auditImpersonatedActionFromRequest(request, "invite_create", { teamId, email, role })

    // Check if user already has membership
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      const existingMembership = await prisma.membership.findUnique({
        where: {
          userId_teamId: {
            userId: existingUser.id,
            teamId,
          },
        },
      })
      if (existingMembership) {
        return NextResponse.json({ error: "User is already a member of this team" }, { status: 400 })
      }
    }

    // Check for existing pending invite
    const existingInvite = await prisma.invite.findFirst({
      where: {
        teamId,
        email,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    })

    if (existingInvite) {
      return NextResponse.json({ error: "An active invite already exists for this email" }, { status: 400 })
    }

    // Generate invite token
    const token = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiry

    const invite = await prisma.invite.create({
      data: {
        teamId,
        email,
        role,
        token,
        expiresAt,
        createdBy: session.user.id,
      },
      include: {
        creator: { select: { name: true, email: true } },
      },
    })

    // TODO: Send email with invite link
    // For now, the invite link would be: /invite/[token]

    await prisma.auditLog.create({
      data: {
        teamId,
        actorUserId: session.user.id,
        action: "invite_sent",
        metadata: { inviteId: invite.id, email, role },
      },
    })

    return NextResponse.json(invite)
  } catch (error: any) {
    console.error("Invite error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
