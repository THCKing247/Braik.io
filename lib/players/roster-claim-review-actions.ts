import type { SupabaseClient } from "@supabase/supabase-js"
import { notifyTeamStaff } from "@/lib/notifications/team-staff-notify"

type Result = { ok: true } | { ok: false; error: string; status: number }

export async function approvePendingPlayer(
  supabase: SupabaseClient,
  params: { teamId: string; playerId: string; coachUserId: string }
): Promise<Result> {
  const { data: row, error: fetchErr } = await supabase
    .from("players")
    .select("id, team_id, self_registered, claim_status")
    .eq("id", params.playerId)
    .eq("team_id", params.teamId)
    .maybeSingle()

  if (fetchErr || !row) {
    return { ok: false, error: "Player not found.", status: 404 }
  }
  if (!row.self_registered || row.claim_status !== "pending_review") {
    return { ok: false, error: "That player is not awaiting approval.", status: 400 }
  }

  const { error } = await supabase
    .from("players")
    .update({
      claim_status: "claimed",
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.playerId)
    .eq("team_id", params.teamId)

  if (error) {
    return { ok: false, error: error.message, status: 500 }
  }

  return { ok: true }
}

/**
 * Moves auth user from self-reg row onto an existing coach roster row; archives the self-reg row.
 */
export async function linkPendingPlayerToRosterRow(
  supabase: SupabaseClient,
  params: {
    teamId: string
    pendingPlayerId: string
    rosterPlayerId: string
    coachUserId: string
  }
): Promise<Result> {
  if (params.pendingPlayerId === params.rosterPlayerId) {
    return { ok: false, error: "Cannot link a player to the same row.", status: 400 }
  }

  const { data: pending, error: pErr } = await supabase
    .from("players")
    .select("id, team_id, user_id, self_registered, claim_status, email, first_name, last_name")
    .eq("id", params.pendingPlayerId)
    .maybeSingle()

  const { data: roster, error: rErr } = await supabase
    .from("players")
    .select("id, team_id, user_id, claim_status, email")
    .eq("id", params.rosterPlayerId)
    .maybeSingle()

  if (pErr || rErr || !pending || !roster) {
    return { ok: false, error: "Players not found.", status: 404 }
  }

  if (pending.team_id !== params.teamId || roster.team_id !== params.teamId) {
    return { ok: false, error: "Team mismatch.", status: 400 }
  }
  if (!pending.user_id || !pending.self_registered || pending.claim_status !== "pending_review") {
    return { ok: false, error: "Pending player row is not eligible for linking.", status: 400 }
  }
  if (roster.user_id || roster.claim_status !== "unclaimed") {
    return { ok: false, error: "Roster spot is already claimed or not unclaimed.", status: 400 }
  }

  const userId = pending.user_id as string
  const now = new Date().toISOString()

  const rosterEmail = (roster as { email?: string | null }).email ?? null
  const pendingEmail = (pending as { email?: string | null }).email ?? null

  const { data: targetUpdated, error: u1 } = await supabase
    .from("players")
    .update({
      user_id: userId,
      claimed_at: now,
      claim_status: "claimed",
      invite_status: "joined",
      email: rosterEmail || pendingEmail,
    })
    .eq("id", params.rosterPlayerId)
    .eq("team_id", params.teamId)
    .is("user_id", null)
    .select("id")
    .maybeSingle()

  if (u1 || !targetUpdated?.id) {
    return { ok: false, error: "Could not update roster row (it may have been claimed).", status: 409 }
  }

  const { error: u2 } = await supabase
    .from("players")
    .update({
      user_id: null,
      claim_status: "unclaimed",
      status: "inactive",
      notes: `Merged by coach into roster row ${params.rosterPlayerId}`,
      updated_at: now,
    })
    .eq("id", params.pendingPlayerId)
    .eq("team_id", params.teamId)

  if (u2) {
    return { ok: false, error: u2.message, status: 500 }
  }

  try {
    await notifyTeamStaff(supabase, params.teamId, {
      type: "roster_change",
      title: "Roster link resolved",
      body: "A self-registered player was linked to an existing roster spot.",
      linkUrl: "/dashboard/roster/review",
    })
  } catch {
    /* non-fatal */
  }

  return { ok: true }
}

export async function markPlayerInactive(
  supabase: SupabaseClient,
  params: { teamId: string; playerId: string; coachUserId: string }
): Promise<Result> {
  const { data: row } = await supabase
    .from("players")
    .select("id, team_id, self_registered, claim_status, user_id")
    .eq("id", params.playerId)
    .eq("team_id", params.teamId)
    .maybeSingle()

  if (!row) {
    return { ok: false, error: "Player not found.", status: 404 }
  }

  if (row.self_registered && row.claim_status === "pending_review") {
    const uid = row.user_id as string | null
    const { error } = await supabase
      .from("players")
      .update({
        status: "inactive",
        user_id: null,
        claim_status: "unclaimed",
        self_registered: false,
        notes: "Dismissed from pending review by coach",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.playerId)
      .eq("team_id", params.teamId)

    if (error) return { ok: false, error: error.message, status: 500 }

    if (uid) {
      await supabase
        .from("team_members")
        .delete()
        .eq("team_id", params.teamId)
        .eq("user_id", uid)
        .eq("role", "player")
    }

    return { ok: true }
  }

  return { ok: false, error: "Only pending self-registrations can be dismissed this way.", status: 400 }
}
