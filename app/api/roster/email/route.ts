import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission } from "@/lib/auth/rbac"
import { buildRosterPrintPayload } from "@/lib/roster/roster-print-payload"
import { generateRosterEmailHTML } from "@/lib/roster/roster-email-html"
import { sendPostmarkEmail } from "@/lib/email/postmark"

/**
 * POST /api/roster/email
 * Body: teamId, recipientEmail, subject?, message?, playerIds? (subset to email)
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
      subject,
      message,
      playerIds,
    } = body as {
      teamId?: string
      recipientEmail?: string
      subject?: string
      message?: string
      playerIds?: string[]
    }

    if (!teamId || !recipientEmail?.trim()) {
      return NextResponse.json({ error: "teamId and recipientEmail are required" }, { status: 400 })
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
      subject: subj,
      htmlBody: htmlContent,
    })

    if (!result.ok) {
      if (result.error.includes("not configured")) {
        return NextResponse.json(
          {
            error: "Email not configured",
            detail: result.error,
            hint: "Set POSTMARK_SERVER_TOKEN and POSTMARK_FROM_EMAIL (verified sender in Postmark).",
          },
          { status: 503 }
        )
      }
      return NextResponse.json({ error: result.error }, { status: result.status && result.status >= 400 ? result.status : 502 })
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
