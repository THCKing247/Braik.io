import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { logInviteAction } from "@/lib/audit/structured-logger"
import { upsertStaffTeamMember } from "@/lib/team-members-sync"

/**
 * POST /api/player-invites/redeem
 * Body: { token?: string, code?: string }
 * Authenticated user redeems a player invite by token or code to link their account to the roster spot.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as { token?: string; code?: string }
    const token = typeof body?.token === "string" ? body.token.trim() : ""
    const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : ""
    if (!token && !code) {
      return NextResponse.json({ error: "Token or code is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const userId = session.user.id

    let invite: { id: string; player_id: string; team_id: string; status: string; expires_at: string | null } | null = null
    if (token) {
      const { data, error: inviteErr } = await supabase
        .from("player_invites")
        .select("id, player_id, team_id, status, expires_at")
        .eq("token", token)
        .maybeSingle()
      if (inviteErr) {
        logInviteAction("invite_redeem_failure", { reason: "db_error", error: inviteErr.message })
        return NextResponse.json({ error: "Invite not found or invalid." }, { status: 404 })
      }
      invite = data
    } else {
      const { data, error: inviteErr } = await supabase
        .from("player_invites")
        .select("id, player_id, team_id, status, expires_at")
        .eq("code", code)
        .maybeSingle()
      if (inviteErr) {
        logInviteAction("invite_redeem_failure", { reason: "db_error", error: inviteErr.message })
        return NextResponse.json({ error: "Invite not found or invalid." }, { status: 404 })
      }
      invite = data
    }

    if (!invite) {
      logInviteAction("invite_redeem_failure", { reason: "not_found" })
      return NextResponse.json({ error: "Invite not found or invalid." }, { status: 404 })
    }

    if (invite.status !== "pending" && invite.status !== "sent") {
      logInviteAction("invite_redeem_failure", { playerId: invite.player_id, inviteId: invite.id, reason: "already_used_or_revoked" })
      return NextResponse.json({ error: "This invite has already been used or revoked." }, { status: 400 })
    }

    if (invite.expires_at) {
      const exp = new Date(invite.expires_at)
      if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        logInviteAction("invite_redeem_failure", { playerId: invite.player_id, inviteId: invite.id, reason: "expired" })
        return NextResponse.json({ error: "This invite has expired." }, { status: 400 })
      }
    }

    const playerId = invite.player_id
    const teamId = invite.team_id

    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select("id, user_id")
      .eq("id", playerId)
      .maybeSingle()

    if (playerErr || !player) {
      logInviteAction("invite_redeem_failure", { playerId, inviteId: invite.id, reason: "player_not_found" })
      return NextResponse.json({ error: "Player record not found." }, { status: 404 })
    }

    if ((player as { user_id: string | null }).user_id) {
      logInviteAction("invite_redeem_failure", { playerId, inviteId: invite.id, reason: "already_linked" })
      return NextResponse.json(
        { error: "This roster spot is already linked to another account." },
        { status: 400 }
      )
    }

    const { error: updatePlayerErr } = await supabase
      .from("players")
      .update({
        user_id: userId,
        claimed_at: new Date().toISOString(),
        invite_status: "joined",
      })
      .eq("id", playerId)

    if (updatePlayerErr) {
      console.error("[POST /api/player-invites/redeem] player update", updatePlayerErr)
      logInviteAction("invite_redeem_failure", { playerId, inviteId: invite.id, error: updatePlayerErr.message })
      return NextResponse.json({ error: "Failed to link profile" }, { status: 500 })
    }

    const { error: updateInviteErr } = await supabase
      .from("player_invites")
      .update({
        status: "claimed",
        claimed_by_user_id: userId,
        claimed_at: new Date().toISOString(),
      })
      .eq("id", invite.id)

    if (updateInviteErr) {
      console.error("[POST /api/player-invites/redeem] player_invites update", updateInviteErr)
    }

    const { error: tmErr } = await upsertStaffTeamMember(supabase, teamId, userId, "player", {
      source: "api_player_invites_redeem",
    })
    if (tmErr) {
      console.error("[POST /api/player-invites/redeem] team_members", tmErr)
      return NextResponse.json({ error: "Failed to save team membership" }, { status: 500 })
    }

    logInviteAction("invite_redeem_success", { playerId, inviteId: invite.id })
    return NextResponse.json({
      success: true,
      player_id: playerId,
      team_id: teamId,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error"
    console.error("[POST /api/player-invites/redeem]", err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
