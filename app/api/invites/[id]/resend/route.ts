import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamPermission } from "@/lib/rbac"
import crypto from "crypto"

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

    await requireTeamPermission(invite.teamId, "edit_roster")

    // Generate new token and extend expiry
    const newToken = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await prisma.invite.update({
      where: { id: params.id },
      data: {
        token: newToken,
        expiresAt,
      },
    })

    // TODO: Send email with new invite link

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Resend invite error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
