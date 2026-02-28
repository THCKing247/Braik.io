import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeAdminAuditLog } from "@/lib/admin-audit"

export interface AdminAccessContext {
  actorId: string
  actorEmail: string
}

export async function getAdminAccessForApi(): Promise<
  { ok: true; context: AdminAccessContext } | { ok: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const sessionUserId = session.user.id
  const sessionEmail = session.user.email
  const isBootstrapAdminSession = sessionUserId.startsWith("bootstrap-admin:")
  if (isBootstrapAdminSession) {
    return {
      ok: true,
      context: {
        actorId: sessionUserId,
        actorEmail: sessionEmail,
      },
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true, isPlatformOwner: true, role: true, status: true, email: true },
  })

  const isAdmin = typeof user?.role === "string" && user.role.toLowerCase() === "admin"
  const isPlatformOwner = user?.isPlatformOwner === true
  if ((!isAdmin && !isPlatformOwner) || user?.status === "DISABLED") {
    if (session.user.id) {
      await writeAdminAuditLog({
        actorId: session.user.id,
        action: "admin_access_denied",
        targetType: "api",
        targetId: "admin_api",
        metadata: { reason: "non_admin_role_or_disabled" },
      }).catch(() => undefined)
    }
    return {
      ok: false,
      response: NextResponse.json({ error: "Access denied: Admin only" }, { status: 403 }),
    }
  }

  return {
    ok: true,
    context: {
      actorId: sessionUserId,
      actorEmail: user?.email || sessionEmail,
    },
  }
}

export async function hasAdminAccess(userId: string, email?: string | null): Promise<boolean> {
  if (userId.startsWith("bootstrap-admin:")) {
    return true
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, isPlatformOwner: true, role: true, status: true },
  })

  const isAdmin = typeof user?.role === "string" && user.role.toLowerCase() === "admin"
  const isPlatformOwner = user?.isPlatformOwner === true
  if ((!isAdmin && !isPlatformOwner) || user?.status === "DISABLED") {
    return false
  }

  return true
}
