import crypto from "crypto"
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
    const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : ""
    const reason = typeof body.reason === "string" ? body.reason.trim() : null
    const durationMinutes = Number(body.durationMinutes || 10)

    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId is required" }, { status: 400 })
    }

    if (durationMinutes < 5 || durationMinutes > 15) {
      return NextResponse.json({ error: "durationMinutes must be between 5 and 15" }, { status: 400 })
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: targetUserId },
      select: { teamId: true },
      orderBy: { createdAt: "desc" },
    })

    const token = crypto.randomBytes(24).toString("hex")
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000)

    const session = await prisma.adminImpersonationSession.create({
      data: {
        actorAdminId: access.context.actorId,
        targetUserId,
        targetTeamId: membership?.teamId || null,
        tokenHash,
        expiresAt,
        reason,
      },
      select: {
        id: true,
        targetUserId: true,
        targetTeamId: true,
        startedAt: true,
        expiresAt: true,
      },
    })

    await writeAdminAuditLog({
      actorId: access.context.actorId,
      action: "impersonation_started",
      targetType: "user",
      targetId: targetUserId,
      metadata: {
        sessionId: session.id,
        durationMinutes,
        reason,
      },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    })

    const response = NextResponse.json({
      success: true,
      supportToken: token,
      session,
      warning: "Support session token is time-limited. Block sensitive actions while using it.",
    })
    response.cookies.set("braik_support_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    })
    return response
  } catch (error: any) {
    console.error("Admin impersonation start error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
