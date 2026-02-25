import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminAccessForApi } from "@/lib/admin-access"
import { writeAdminAuditLog } from "@/lib/admin-audit"

export async function POST(request: Request) {
  try {
    const access = await getAdminAccessForApi()
    if (!access.ok) {
      return access.response
    }

    const body = await request.json()
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : ""
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
    }

    const existing = await prisma.adminImpersonationSession.findUnique({
      where: { id: sessionId },
      select: { id: true, actorAdminId: true, targetUserId: true, active: true },
    })
    if (!existing) {
      return NextResponse.json({ error: "Impersonation session not found" }, { status: 404 })
    }
    if (existing.actorAdminId !== access.context.actorId) {
      return NextResponse.json({ error: "You can only end your own impersonation sessions" }, { status: 403 })
    }

    const ended = await prisma.adminImpersonationSession.update({
      where: { id: existing.id },
      data: {
        active: false,
        endedAt: new Date(),
      },
      select: { id: true, endedAt: true, active: true },
    })

    await writeAdminAuditLog({
      actorId: access.context.actorId,
      action: "impersonation_ended",
      targetType: "user",
      targetId: existing.targetUserId,
      metadata: { sessionId: existing.id },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    })

    const response = NextResponse.json({ success: true, session: ended })
    response.cookies.set("braik_support_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(0),
    })
    return response
  } catch (error: any) {
    console.error("Admin impersonation end error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
