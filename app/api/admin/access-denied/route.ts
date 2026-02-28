import { NextResponse } from "next/server"
import { writeAdminAuditLog } from "@/lib/admin-audit"

export async function POST(request: Request) {
  try {
    const internalKey = process.env.ADMIN_AUDIT_INTERNAL_KEY || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
    const requestKey = request.headers.get("x-admin-audit-key")
    if (!internalKey || requestKey !== internalKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const actorUserId = typeof body.actorUserId === "string" ? body.actorUserId : null
    if (!actorUserId) {
      return NextResponse.json({ ok: true })
    }

    const path = typeof body.path === "string" ? body.path : null
    const reason = typeof body.reason === "string" ? body.reason : "admin_access_denied"

    await writeAdminAuditLog({
      actorId: actorUserId,
      action: "admin_access_denied",
      targetType: "route",
      targetId: path || "unknown",
      metadata: {
        path,
        reason,
      },
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("admin access denied audit logging error", error)
    return NextResponse.json({ ok: true })
  }
}
