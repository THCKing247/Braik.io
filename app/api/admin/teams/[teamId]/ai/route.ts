import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminAccessForApi } from "@/lib/admin-access"
import { writeAdminAuditLog } from "@/lib/admin-audit"

export async function PATCH(
  request: Request,
  { params }: { params: { teamId: string } }
) {
  try {
    const access = await getAdminAccessForApi()
    if (!access.ok) return access.response

    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (typeof body.aiEnabled === "boolean") data.aiEnabled = body.aiEnabled
    if (typeof body.baseAiCredits === "number") data.baseAiCredits = body.baseAiCredits
    if (typeof body.aiUsageThisCycle === "number") data.aiUsageThisCycle = body.aiUsageThisCycle
    if (typeof body.aiDisabledByPlatform === "boolean") data.aiDisabledByPlatform = body.aiDisabledByPlatform

    const team = await prisma.team.update({
      where: { id: params.teamId },
      data,
      select: {
        id: true,
        aiEnabled: true,
        aiDisabledByPlatform: true,
        baseAiCredits: true,
        aiUsageThisCycle: true,
      },
    })

    await writeAdminAuditLog({
      actorId: access.context.actorId,
      action: "admin_team_ai_updated",
      targetType: "team",
      targetId: team.id,
      metadata: { fields: Object.keys(data) },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    })

    return NextResponse.json({ success: true, team })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
