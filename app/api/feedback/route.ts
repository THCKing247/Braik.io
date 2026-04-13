import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseAdminClient } from "@/lib/supabase/supabase-admin"
import { resolveAnalyticsTeamContext } from "@/lib/analytics/resolve-team-context"
import { sendEmail } from "@/lib/email/postmark"

const CATEGORIES = new Set(["bug", "feature_request", "support_question", "general"])

/** Inbox for portal feedback (Postmark delivery). */
const FEEDBACK_SUPPORT_INBOX = "support@apextsgroup.com"

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * POST /api/feedback — authenticated users only; ties optional team context for triage.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as {
      category?: string
      subject?: string
      body?: string
      teamId?: string
      pagePath?: string
    } | null

    const category = typeof body?.category === "string" ? body.category.trim() : ""
    if (!CATEGORIES.has(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 })
    }

    const text = typeof body?.body === "string" ? body.body.trim() : ""
    if (text.length < 8) {
      return NextResponse.json({ error: "Please add a bit more detail (at least 8 characters)." }, { status: 400 })
    }
    if (text.length > 12000) {
      return NextResponse.json({ error: "Message is too long." }, { status: 400 })
    }

    const subject = typeof body?.subject === "string" ? body.subject.trim().slice(0, 200) : null
    const teamId = typeof body?.teamId === "string" && body.teamId.trim() ? body.teamId.trim() : null
    const pagePath = typeof body?.pagePath === "string" ? body.pagePath.trim().slice(0, 500) : null

    const admin = getSupabaseAdminClient()
    if (!admin) {
      return NextResponse.json({ error: "Feedback storage is not configured" }, { status: 503 })
    }

    const ctx = await resolveAnalyticsTeamContext(admin, teamId)

    const { data: inserted, error } = await admin
      .from("user_feedback")
      .insert({
        user_id: session.user.id,
        team_id: teamId,
        program_id: ctx.program_id,
        organization_id: ctx.organization_id,
        category,
        subject: subject || null,
        body: text,
        page_path: pagePath,
        user_role: session.user.role ? String(session.user.role).slice(0, 64) : null,
      })
      .select("id")
      .single()

    if (error) {
      console.error("[POST /api/feedback]", error)
      return NextResponse.json({ error: "Could not save feedback" }, { status: 500 })
    }

    const feedbackId = inserted?.id as string | undefined
    const userEmail = session.user.email?.trim() || ""
    const userLabel = [session.user.name?.trim(), userEmail].filter(Boolean).join(" · ") || userEmail || session.user.id

    const subjectLine = subject
      ? `[Braik feedback · ${category}] ${subject}`
      : `[Braik feedback · ${category}] (no subject)`

    const metaLines = [
      `Feedback ID: ${feedbackId ?? "—"}`,
      `From: ${userLabel}`,
      userEmail ? `Reply-To: ${userEmail}` : null,
      `User ID: ${session.user.id}`,
      `Category: ${category}`,
      teamId ? `Team ID: ${teamId}` : null,
      ctx.program_id ? `Program ID: ${ctx.program_id}` : null,
      ctx.organization_id ? `Organization ID: ${ctx.organization_id}` : null,
      pagePath ? `Page: ${pagePath}` : null,
      session.user.role ? `Role: ${session.user.role}` : null,
    ]
      .filter(Boolean)
      .join("\n")

    const textBody = `${metaLines}\n\n---\n\n${text}`

    const htmlBody = `
<p><strong>${escapeHtml(subjectLine)}</strong></p>
<pre style="font-family:system-ui,sans-serif;font-size:13px;white-space:pre-wrap;">${escapeHtml(metaLines)}</pre>
<hr />
<p style="white-space:pre-wrap;">${escapeHtml(text)}</p>
`.trim()

    const mail = await sendEmail({
      to: FEEDBACK_SUPPORT_INBOX,
      subject: subjectLine,
      textBody,
      htmlBody,
      replyTo: userEmail || undefined,
      tag: "portal-feedback",
      metadata: {
        feedback_id: feedbackId ?? "",
        category,
        user_id: session.user.id,
      },
    })

    if (!mail.ok) {
      if (feedbackId) {
        await admin.from("user_feedback").delete().eq("id", feedbackId)
      }
      console.error("[POST /api/feedback] email failed", mail.error)
      return NextResponse.json(
        {
          error:
            mail.code === "POSTMARK_NOT_CONFIGURED"
              ? "Email delivery is not configured. Set POSTMARK_SERVER_TOKEN on the server."
              : mail.error || "Could not deliver feedback email.",
        },
        { status: 503 }
      )
    }

    return NextResponse.json({ ok: true, id: feedbackId })
  } catch (e) {
    console.error("[POST /api/feedback]", e)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
