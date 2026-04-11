import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission } from "@/lib/auth/rbac"
import { buildRosterPrintPayload } from "@/lib/roster/roster-print-payload"
import { generateRosterEmailHTML } from "@/lib/roster/roster-email-html"
import { sendPostmarkEmail } from "@/lib/email/postmark"

const SIMPLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeRosterEmailCc(raw: string | undefined): { ok: true; cc?: string } | { ok: false; error: string } {
  if (raw == null || !String(raw).trim()) return { ok: true }
  const parts = String(raw)
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean)
  for (const p of parts) {
    if (!SIMPLE_EMAIL.test(p)) {
      return { ok: false, error: `Invalid CC address: ${p}` }
    }
  }
  return { ok: true, cc: parts.join(", ") }
}

/**
 * POST /api/roster/email
 * Body: teamId, recipientEmail, cc?, subject?, message?, playerIds? (subset to email)
 * Sends HTML roster via Postmark when POSTMARK_SERVER_TOKEN + POSTMARK_FROM_EMAIL are set.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      teamId,
      recipientEmail,
      cc,
      subject,
      message,
      playerIds,
    } = body as {
      teamId?: string
      recipientEmail?: string
      /** Comma-separated CC addresses (Postmark Cc field). */
      cc?: string
      subject?: string
      message?: string
      playerIds?: string[]
    }

    if (!teamId || !recipientEmail?.trim()) {
      return NextResponse.json({ error: "teamId and recipientEmail are required" }, { status: 400 })
    }

    const ccNorm = normalizeRosterEmailCc(cc)
    if (!ccNorm.ok) {
      return NextResponse.json({ error: ccNorm.error }, { status: 400 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    const supabase = getSupabaseServer()
    const payload = await buildRosterPrintPayload(supabase, teamId, {
      playerIds: Array.isArray(playerIds) && playerIds.length > 0 ? playerIds : undefined,
      fullRoster: true,
    })

    if (!("success" in payload && payload.success)) {
      return NextResponse.json(
        { error: "error" in payload ? payload.error : "Failed to build roster" },
        { status: 500 }
      )
    }

    if (payload.players.length === 0) {
      return NextResponse.json({ error: "No players selected for this email" }, { status: 400 })
    }

    const htmlContent = generateRosterEmailHTML(payload, message || "")
    const subj = subject?.trim() || `Roster — ${payload.team.name} — ${new Date().toLocaleDateString()}`
    const result = await sendPostmarkEmail({
      to: recipientEmail.trim(),
      cc: ccNorm.cc,
      subject: subj,
      htmlBody: htmlContent,
      tag: "roster-email",
    })

    if (!result.ok) {
      if (result.code === "POSTMARK_NOT_CONFIGURED") {
        return NextResponse.json(
          {
            code: "POSTMARK_NOT_CONFIGURED" as const,
            message:
              "Postmark is not configured. Set POSTMARK_SERVER_TOKEN and POSTMARK_FROM_EMAIL, and make sure the sender is verified in Postmark.",
            error: result.error,
          },
          { status: 503 }
        )
      }
      return NextResponse.json(
        {
          code: result.code ?? "POSTMARK_API_ERROR",
          error: result.error,
          errorCode: result.errorCode,
        },
        { status: result.status && result.status >= 400 ? result.status : 502 }
      )
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      playerCount: payload.players.length,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to send roster email"
    console.error("[POST /api/roster/email]", error)
    return NextResponse.json(
      { error: message },
      { status: message.includes("Access denied") ? 403 : 500 }
    )
  }
}
