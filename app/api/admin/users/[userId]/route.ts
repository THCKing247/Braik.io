import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminAccessForApi } from "@/lib/admin-access"
import { writeAdminAuditLog } from "@/lib/admin-audit"

export async function GET(
  _request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const access = await getAdminAccessForApi()
    if (!access.ok) {
      return access.response
    }

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      include: {
        memberships: {
          include: {
            team: {
              select: { id: true, name: true, teamStatus: true, subscriptionStatus: true },
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const access = await getAdminAccessForApi()
    if (!access.ok) {
      return access.response
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (typeof body.name === "string") data.name = body.name.trim() || null
    if (typeof body.email === "string") data.email = body.email.trim().toLowerCase()
    if (typeof body.role === "string") data.role = body.role
    if (typeof body.status === "string") data.status = body.status
    if (typeof body.aiTier === "string") data.aiTier = body.aiTier
    if (typeof body.aiAutoRechargeEnabled === "boolean") data.aiAutoRechargeEnabled = body.aiAutoRechargeEnabled

    const user = await prisma.user.update({
      where: { id: params.userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        aiTier: true,
        aiCreditsRemaining: true,
      },
    })

    await writeAdminAuditLog({
      actorId: access.context.actorId,
      action: "admin_user_updated",
      targetType: "user",
      targetId: user.id,
      metadata: { fields: Object.keys(data) },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    })

    return NextResponse.json({ success: true, user })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const access = await getAdminAccessForApi()
    if (!access.ok) {
      return access.response
    }

    if (params.userId === access.context.actorId) {
      return NextResponse.json({ error: "You cannot delete your own admin account" }, { status: 400 })
    }

    await prisma.user.delete({
      where: { id: params.userId },
    })

    await writeAdminAuditLog({
      actorId: access.context.actorId,
      action: "admin_user_deleted",
      targetType: "user",
      targetId: params.userId,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
