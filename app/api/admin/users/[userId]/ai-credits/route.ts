import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminAccessForApi } from "@/lib/admin-access"
import { writeAdminAuditLog } from "@/lib/admin-audit"

export async function POST(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const access = await getAdminAccessForApi()
    if (!access.ok) {
      return access.response
    }

    const body = await request.json()
    const delta = Number(body.delta || 0)
    if (!Number.isFinite(delta) || delta === 0) {
      return NextResponse.json({ error: "delta must be a non-zero number" }, { status: 400 })
    }

    const user = await prisma.user.update({
      where: { id: params.userId },
      data: {
        aiCreditsRemaining: {
          increment: delta,
        },
      },
      select: {
        id: true,
        aiCreditsRemaining: true,
      },
    })

    await writeAdminAuditLog({
      actorId: access.context.actorId,
      action: "admin_user_ai_credits_adjusted",
      targetType: "user",
      targetId: user.id,
      metadata: { delta, nextBalance: user.aiCreditsRemaining },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    })

    return NextResponse.json({ success: true, user })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
