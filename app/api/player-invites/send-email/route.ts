import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"
import { buildJoinLink } from "@/lib/invites/build-join-link"
import { sendPlayerInviteEmail } from "@/lib/email/braik-emails"
import { logInviteAction } from "@/lib/audit/structured-logger"

/**
 * POST /api/player-invites/send-email
 * Body: { playerId: string }
 * Sends invite email via Postmark. Requires coach/admin with edit_roster.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { playerId?: string }
    const playerId = typeof body?.playerId === "string" ? body.playerId.trim() : ""
    if (!playerId) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select("id, team_id, first_name, last_name, email, user_id")
      .eq("id", playerId)
      .maybeSingle()

    if (playerErr || !player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    await requireTeamPermission((player as { team_id: string }).team_id, "edit_roster")

    if ((player as { user_id?: string | null }).user_id) {
      return NextResponse.json({ error: "This player has already linked an account." }, { status: 400 })
    }

    const email = (player as { email?: string | null }).email
    const emailStr = typeof email === "string" ? email.trim() : ""
    if (!emailStr) {
      logInviteAction("send_email_skipped", { playerId, reason: "missing_email" })
      return NextResponse.json({ error: "Missing email", code: "MISSING_EMAIL" }, { status: 400 })
    }

    const { data: invite, error: inviteErr } = await supabase
      .from("player_invites")
      .select("id, token, code, status")
      .eq("player_id", playerId)
      .in("status", ["pending", "sent"])
      .maybeSingle()

    if (inviteErr || !invite) {
      return NextResponse.json({ error: "No pending invite found for this player. Create an invite first." }, { status: 404 })
    }

    const token = (invite as { token: string }).token
    const code = (invite as { code?: string | null }).code ?? ""
    const joinLink = buildJoinLink(token)
    const playerName = `${(player as { first_name: string }).first_name} ${(player as { last_name: string }).last_name}`.trim() || "Player"

    const result = await sendPlayerInviteEmail({
      to: emailStr,
      playerName,
      joinLink,
      code: code || null,
      metadata: {
        playerId: String(playerId),
        teamId: String((player as { team_id: string }).team_id),
      },
    })

    const inviteId = (invite as { id: string }).id

    if (result.ok) {
      await supabase
        .from("player_invites")
        .update({
          sent_email_at: new Date().toISOString(),
          email_error: null,
          status: "sent",
        })
        .eq("id", inviteId)
      logInviteAction("send_email_success", { playerId, inviteId })
      return NextResponse.json({ success: true })
    }

    await supabase
      .from("player_invites")
      .update({ email_error: result.error ?? "Unknown error" })
      .eq("id", inviteId)
    logInviteAction("send_email_failure", { playerId, inviteId, error: result.error })
    return NextResponse.json(
      { error: result.error ?? "Failed to send email", code: "EMAIL_SEND_FAILED" },
      { status: 502 }
    )
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      console.error("[POST /api/player-invites/send-email] membership lookup failed", err.message)
      return NextResponse.json({ error: "Failed to send invite" }, { status: 500 })
    }
    const msg = err instanceof Error ? err.message : "Internal server error"
    if (msg.includes("Access denied") || msg.includes("Insufficient")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[POST /api/player-invites/send-email]", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
