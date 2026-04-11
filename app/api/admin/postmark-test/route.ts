import { NextResponse } from "next/server"
import { getAdminAccessForApi } from "@/lib/admin/admin-access"
import { sendEmail } from "@/lib/email/postmark"
import { isPostmarkConfigured } from "@/lib/email/postmark-config"
import { writeAdminAuditLog } from "@/lib/audit/admin-audit"

export const runtime = "nodejs"

/**
 * POST /api/admin/postmark-test
 * Body: { to?: string } — sends a minimal test message. Admin or dev session only.
 */
export async function POST(request: Request) {
  const isDev = process.env.NODE_ENV === "development"

  if (!isDev) {
    const access = await getAdminAccessForApi()
    if (!access.ok) return access.response
  } else {
    const { getServerSession } = await import("@/lib/auth/server-auth")
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }
  }

  if (!isPostmarkConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Postmark is not configured",
        detail: "Set POSTMARK_SERVER_TOKEN and POSTMARK_FROM_EMAIL on the server.",
      },
      { status: 503 }
    )
  }

  let body: { to?: string }
  try {
    body = (await request.json()) as { to?: string }
  } catch {
    body = {}
  }

  const to = typeof body.to === "string" && body.to.includes("@") ? body.to.trim() : null
  if (!to) {
    return NextResponse.json(
      { ok: false, error: 'Request body must include { "to": "verified-recipient@example.com" }' },
      { status: 400 }
    )
  }

  const result = await sendEmail({
    to,
    subject: "[Braik] Postmark test",
    textBody: `This is a test email from Braik (${new Date().toISOString()}).`,
    htmlBody: `<p>This is a <strong>test email</strong> from Braik.</p><p style="color:#64748b;font-size:12px;">${new Date().toISOString()}</p>`,
    tag: "postmark-test",
  })

  const { getServerSession } = await import("@/lib/auth/server-auth")
  const session = await getServerSession()
  if (session?.user?.id) {
    await writeAdminAuditLog({
      actorId: session.user.id,
      action: "postmark_test_send",
      targetType: "email",
      targetId: "postmark",
      metadata: { ok: result.ok, toDomain: to.split("@")[1] ?? "unknown" },
    }).catch(() => undefined)
  }

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, status: result.status, errorCode: result.errorCode },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true, messageId: result.messageId })
}
