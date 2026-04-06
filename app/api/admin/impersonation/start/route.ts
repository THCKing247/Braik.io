import { NextRequest, NextResponse } from "next/server"
import { requirePermissionForApi } from "@/lib/permissions/platform-permissions"
import {
  createImpersonationToken,
  impersonationCookieHeader,
} from "@/lib/admin/impersonation"

const DEFAULT_DURATION_MINUTES = 60

export async function POST(request: NextRequest) {
  const access = await requirePermissionForApi("impersonate_users")
  if (!access.ok) return access.response

  let body: { targetUserId?: string; durationMinutes?: number }
  try {
    body = (await request.json()) as { targetUserId?: string; durationMinutes?: number }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId.trim() : null
  if (!targetUserId) {
    return NextResponse.json({ error: "targetUserId is required" }, { status: 400 })
  }

  const durationMinutes = typeof body.durationMinutes === "number"
    ? Math.min(120, Math.max(1, body.durationMinutes))
    : DEFAULT_DURATION_MINUTES
  const maxAgeSec = durationMinutes * 60

  const token = createImpersonationToken({
    adminId: access.context.actorId,
    targetUserId,
    maxAgeSec,
  })

  const cookie = impersonationCookieHeader(token, maxAgeSec)
  const response = NextResponse.json({ redirect: "/dashboard", ok: true })
  response.headers.set("Set-Cookie", cookie)
  return response
}
