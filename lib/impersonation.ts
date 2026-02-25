import crypto from "crypto"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"

export async function getActiveImpersonationFromToken(rawToken?: string | null) {
  if (!rawToken) {
    return null
  }

  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
  const session = await prisma.adminImpersonationSession.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      actorAdminId: true,
      targetUserId: true,
      targetTeamId: true,
      active: true,
      expiresAt: true,
    },
  })

  if (!session || !session.active) {
    return null
  }

  if (session.expiresAt <= new Date()) {
    await prisma.adminImpersonationSession.update({
      where: { id: session.id },
      data: { active: false, endedAt: new Date() },
    })
    return null
  }

  return session
}

export async function getActiveImpersonationFromCookies() {
  const cookieStore = cookies()
  const supportToken = cookieStore.get("braik_support_token")?.value || null
  return getActiveImpersonationFromToken(supportToken)
}

export function getSupportTokenFromRequestCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null
  }

  const cookieParts = cookieHeader.split(";")
  for (const part of cookieParts) {
    const [name, value] = part.trim().split("=")
    if (name === "braik_support_token") {
      return value || null
    }
  }

  return null
}

export async function auditImpersonatedActionFromRequest(
  request: Request,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supportToken = getSupportTokenFromRequestCookieHeader(request.headers.get("cookie"))
  const session = await getActiveImpersonationFromToken(supportToken)
  if (!session) {
    return
  }

  await prisma.adminAuditLog.create({
    data: {
      actorId: session.actorAdminId,
      action: `impersonation_${action}`,
      targetType: "user",
      targetId: session.targetUserId,
      metadata: {
        impersonationSessionId: session.id,
        targetTeamId: session.targetTeamId,
        ...(metadata || {}),
      },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    },
  })
}
