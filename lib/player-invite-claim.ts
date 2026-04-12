import type { SupabaseClient } from "@supabase/supabase-js"
import { logInviteAction } from "@/lib/audit/structured-logger"
import { SIGNUP_ERROR_CODES } from "@/lib/auth/signup-route-error"

export type ClaimPlayerInviteResult =
  | { ok: true; teamId: string; playerId: string }
  | { ok: false; error: string; status: number; code?: string }

/**
 * Links an authenticated user to a roster player via `player_invites` (token or table code)
 * or, if no invite row exists, via `players.invite_code` (unique player code from the team portal).
 */
export async function claimPlayerInviteForUser(
  supabase: SupabaseClient,
  userId: string,
  opts: { token?: string; code?: string }
): Promise<ClaimPlayerInviteResult> {
  const token = typeof opts.token === "string" ? opts.token.trim() : ""
  const codeRaw = typeof opts.code === "string" ? opts.code.trim().toUpperCase() : ""
  if (!token && !codeRaw) {
    return { ok: false, error: "Token or code is required", status: 400, code: SIGNUP_ERROR_CODES.INVALID_INVITE_CODE }
  }

  type InviteRow = {
    id: string
    player_id: string
    team_id: string
    status: string
    expires_at: string | null
  }

  let invite: InviteRow | null = null
  if (token) {
    const { data, error } = await supabase
      .from("player_invites")
      .select("id, player_id, team_id, status, expires_at")
      .eq("token", token)
      .maybeSingle()
    if (error) {
      logInviteAction("invite_redeem_failure", { reason: "db_error", error: error.message })
      return { ok: false, error: "Invite not found or invalid.", status: 404, code: SIGNUP_ERROR_CODES.INVALID_INVITE_CODE }
    }
    invite = data as InviteRow | null
  } else {
    const { data, error } = await supabase
      .from("player_invites")
      .select("id, player_id, team_id, status, expires_at")
      .eq("code", codeRaw)
      .maybeSingle()
    if (error) {
      logInviteAction("invite_redeem_failure", { reason: "db_error", error: error.message })
      return { ok: false, error: "Invite not found or invalid.", status: 404, code: SIGNUP_ERROR_CODES.INVALID_INVITE_CODE }
    }
    invite = data as InviteRow | null
  }

  let playerId: string
  let teamId: string
  let inviteId: string | null = null

  if (invite) {
    if (invite.status !== "pending" && invite.status !== "sent") {
      logInviteAction("invite_redeem_failure", { playerId: invite.player_id, inviteId: invite.id, reason: "already_used_or_revoked" })
      return {
        ok: false,
        error: "This invite has already been used or revoked.",
        status: 400,
        code: SIGNUP_ERROR_CODES.INVALID_INVITE_CODE,
      }
    }
    if (invite.expires_at) {
      const exp = new Date(invite.expires_at)
      if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        logInviteAction("invite_redeem_failure", { playerId: invite.player_id, inviteId: invite.id, reason: "expired" })
        return { ok: false, error: "This invite has expired.", status: 400, code: SIGNUP_ERROR_CODES.INVITE_EXPIRED }
      }
    }
    playerId = invite.player_id
    teamId = invite.team_id
    inviteId = invite.id
  } else if (codeRaw) {
    const { data: playerRow, error: pErr } = await supabase
      .from("players")
      .select("id, team_id, user_id")
      .eq("invite_code", codeRaw)
      .maybeSingle()
    if (pErr || !playerRow) {
      logInviteAction("invite_redeem_failure", { reason: "not_found" })
      return { ok: false, error: "Invite not found or invalid.", status: 404, code: SIGNUP_ERROR_CODES.INVALID_INVITE_CODE }
    }
    if ((playerRow as { user_id?: string | null }).user_id) {
      logInviteAction("invite_redeem_failure", { playerId: (playerRow as { id: string }).id, reason: "already_linked" })
      return {
        ok: false,
        error: "This roster spot is already linked to another account.",
        status: 400,
        code: SIGNUP_ERROR_CODES.PLAYER_ALREADY_LINKED,
      }
    }
    playerId = (playerRow as { id: string }).id
    teamId = (playerRow as { team_id: string }).team_id
  } else {
    logInviteAction("invite_redeem_failure", { reason: "not_found" })
    return { ok: false, error: "Invite not found or invalid.", status: 404, code: SIGNUP_ERROR_CODES.INVALID_INVITE_CODE }
  }

  const { data: player, error: playerErr } = await supabase
    .from("players")
    .select("id, user_id")
    .eq("id", playerId)
    .maybeSingle()

  if (playerErr || !player) {
    logInviteAction("invite_redeem_failure", { playerId, inviteId: inviteId ?? undefined, reason: "player_not_found" })
    return { ok: false, error: "Player record not found.", status: 404, code: SIGNUP_ERROR_CODES.INVALID_INVITE_CODE }
  }

  if ((player as { user_id: string | null }).user_id) {
    logInviteAction("invite_redeem_failure", { playerId, inviteId: inviteId ?? undefined, reason: "already_linked" })
    return {
      ok: false,
      error: "This roster spot is already linked to another account.",
      status: 400,
      code: SIGNUP_ERROR_CODES.PLAYER_ALREADY_LINKED,
    }
  }

  const { error: updatePlayerErr } = await supabase
    .from("players")
    .update({
      user_id: userId,
      claimed_at: new Date().toISOString(),
      invite_status: "joined",
      claim_status: "claimed",
    })
    .eq("id", playerId)

  if (updatePlayerErr) {
    console.error("[claimPlayerInviteForUser] player update", updatePlayerErr)
    logInviteAction("invite_redeem_failure", { playerId, inviteId: inviteId ?? undefined, error: updatePlayerErr.message })
    return { ok: false, error: "Failed to link profile", status: 500, code: SIGNUP_ERROR_CODES.DATABASE_FAILURE }
  }

  if (inviteId) {
    const { error: updateInviteErr } = await supabase
      .from("player_invites")
      .update({
        status: "claimed",
        claimed_by_user_id: userId,
        claimed_at: new Date().toISOString(),
      })
      .eq("id", inviteId)
    if (updateInviteErr) {
      console.error("[claimPlayerInviteForUser] player_invites update", updateInviteErr)
    }
  }

  logInviteAction("invite_redeem_success", { playerId, inviteId: inviteId ?? undefined })
  return { ok: true, teamId, playerId }
}
