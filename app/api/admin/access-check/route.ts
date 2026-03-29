import { NextResponse } from "next/server"
import { getServerSession, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { hasAdminAccess } from "@/lib/admin/admin-access"
import { isAdminEmailAllowed } from "@/lib/admin/admin-security"
import { writeAdminAuditLog } from "@/lib/audit/admin-audit"

export const runtime = "nodejs"

/**
 * Post-mount admin gate. Session is resolved from cookies via JWT `getUser` (not `auth.getSession()`).
 */
export async function GET() {
  const sessionResult = await getServerSession()
  if (!sessionResult?.user?.id) {
    return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 })
  }

  const session = sessionResult
  const roleUpper = (session.user.role ?? "").toUpperCase()
  const isAdminFromProfile = roleUpper === "ADMIN" || roleUpper === "SCHOOL_ADMIN"
  const allowed =
    isAdminEmailAllowed(session.user.email ?? "") ||
    session.user.isPlatformOwner === true ||
    isAdminFromProfile ||
    (await hasAdminAccess(session.user.id, session.user.email))

  if (!allowed) {
    await writeAdminAuditLog({
      actorId: session.user.id,
      action: "admin_access_denied",
      targetType: "route",
      targetId: "/admin",
      metadata: { reason: "api_access_check" },
    }).catch(() => undefined)
    return NextResponse.json({ ok: false, reason: "forbidden" }, { status: 403 })
  }

  const res = NextResponse.json({ ok: true as const, userId: session.user.id })
  if (sessionResult.refreshedSession) {
    applyRefreshedSessionCookies(res, sessionResult.refreshedSession)
  }
  return res
}
