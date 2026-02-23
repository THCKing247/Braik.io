import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamPermission } from "@/lib/rbac"
import crypto from "crypto"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, emails, role } = await request.json()

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: "Emails array is required" }, { status: 400 })
    }

    if (!role) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    const invites = []
    const errors = []

    for (const email of emails) {
      try {
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
            errors.push({ email, error: "Already a member" })
            continue
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
          errors.push({ email, error: "Active invite exists" })
          continue
        }

        // Generate invite token
        const token = crypto.randomBytes(32).toString("hex")
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 7)

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

        invites.push(invite)
      } catch (error: any) {
        errors.push({ email, error: error.message })
      }
    }

    if (invites.length > 0) {
      await prisma.auditLog.create({
        data: {
          teamId,
          actorUserId: session.user.id,
          action: "bulk_invite_sent",
          metadata: { count: invites.length, role },
        },
      })
    }

    return NextResponse.json(invites)
  } catch (error: any) {
    console.error("Bulk invite error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
