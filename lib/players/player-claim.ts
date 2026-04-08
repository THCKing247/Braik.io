import type { SupabaseClient } from "@supabase/supabase-js"
import { assertCanAddActivePlayers } from "@/lib/billing/roster-entitlement"
import { notifyTeamStaff } from "@/lib/notifications/team-staff-notify"
import { upsertStaffTeamMember } from "@/lib/team-members-sync"
import { normalizePlayerJoinCode } from "@/lib/players/join-code-normalize"
import type { PlayerJoinAnalyzeResponse, PlayerJoinIntent } from "./claim-types"
import {
  type PlayerMatchInput,
  type RosterPlayerForMatch,
  resolveMatchDecision,
  scoreTeamRosterForMatch,
  scorePlayerMatch,
} from "./player-match"

/** @deprecated use normalizePlayerJoinCode */
export function normalizeJoinCode(code: string): string {
  return normalizePlayerJoinCode(code)
}

export async function resolveTeamByPlayerJoinCode(
  supabase: SupabaseClient,
  rawCode: string
): Promise<{ teamId: string; teamName: string | null } | null> {
  const code = normalizePlayerJoinCode(rawCode)
  if (!code) return null

  let { data, error } = await supabase.from("teams").select("id, name, player_code").eq("player_code", code).maybeSingle()

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[resolveTeamByPlayerJoinCode] lookup error:", error.message)
    }
    return null
  }

  if (!data?.id) {
    const lower = code.toLowerCase()
    if (lower !== code) {
      const second = await supabase.from("teams").select("id, name, player_code").eq("player_code", lower).maybeSingle()
      data = second.data
      error = second.error
      if (error && process.env.NODE_ENV === "development") {
        console.warn("[resolveTeamByPlayerJoinCode] lowercase fallback error:", error.message)
      }
    }
  }

  if (!data?.id) {
    if (process.env.NODE_ENV === "development") {
      console.info("[resolveTeamByPlayerJoinCode] no row for teams.player_code (upper or lower):", code)
    }
    return null
  }

  const stored = (data as { player_code?: string | null }).player_code
  if (process.env.NODE_ENV === "development" && (stored == null || stored === "")) {
    console.warn("[resolveTeamByPlayerJoinCode] matched team has empty player_code column (unexpected):", data.id)
  }

  return { teamId: data.id as string, teamName: (data.name as string) ?? null }
}

async function loadUnclaimedRosterForMatching(
  supabase: SupabaseClient,
  teamId: string
): Promise<RosterPlayerForMatch[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, first_name, last_name, jersey_number, graduation_year, date_of_birth, position_group, user_id, claim_status, status")
    .eq("team_id", teamId)
    .is("user_id", null)
    .eq("status", "active")
    .in("claim_status", ["unclaimed"])

  if (error || !data?.length) return []

  return (data as RosterPlayerForMatch[]).filter((row) => !row.user_id)
}

export async function analyzePlayerJoinMatch(
  supabase: SupabaseClient,
  params: {
    joinCode: string
    input: PlayerMatchInput
  }
): Promise<PlayerJoinAnalyzeResponse> {
  const resolved = await resolveTeamByPlayerJoinCode(supabase, params.joinCode)
  if (!resolved) {
    return { outcome: "invalid_code" }
  }

  const roster = await loadUnclaimedRosterForMatching(supabase, resolved.teamId)
  const scored = scoreTeamRosterForMatch(roster, params.input)
  const decision = resolveMatchDecision(scored)

  if (decision.outcome === "no_match") {
    return {
      outcome: "no_match",
      teamId: resolved.teamId,
      teamName: resolved.teamName,
      recommendedIntent: "new",
    }
  }

  if (decision.outcome === "auto_claim") {
    return {
      outcome: "auto_claim",
      teamId: resolved.teamId,
      teamName: resolved.teamName,
      recommendedIntent: "auto",
      confirmedPlayerId: decision.autoPlayerId,
    }
  }

  return {
    outcome: "needs_confirmation",
    teamId: resolved.teamId,
    teamName: resolved.teamName,
    candidates: decision.candidates,
    recommendedIntent: "confirm",
  }
}

export type TeamJoinSignupResult =
  | { ok: true; teamId: string; playerId: string; mode: "claimed_existing" | "created_self_registered" }
  | { ok: false; error: string; status: number }

/**
 * Claim-or-create after auth user exists. Call from signup-secure with service client.
 */
export async function processPlayerTeamJoinSignup(
  supabase: SupabaseClient,
  params: {
    teamId: string
    userId: string
    email: string
    firstName: string
    lastName: string
    graduationYear?: number | null
    jerseyNumber?: number | null
    dateOfBirth?: string | null
    intent: PlayerJoinIntent
    confirmedPlayerId?: string | null
  }
): Promise<TeamJoinSignupResult> {
  const input: PlayerMatchInput = {
    firstName: params.firstName,
    lastName: params.lastName,
    jerseyNumber: params.jerseyNumber ?? null,
    graduationYear: params.graduationYear ?? null,
    dateOfBirth: params.dateOfBirth ?? null,
  }

  const roster = await loadUnclaimedRosterForMatching(supabase, params.teamId)
  const scored = scoreTeamRosterForMatch(roster, input)
  const decision = resolveMatchDecision(scored)

  if (params.intent === "new") {
    return createSelfRegisteredPlayer(supabase, {
      teamId: params.teamId,
      userId: params.userId,
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      graduationYear: params.graduationYear ?? null,
      jerseyNumber: params.jerseyNumber ?? null,
      dateOfBirth: params.dateOfBirth ?? null,
    })
  }

  if (params.intent === "confirm" && params.confirmedPlayerId) {
    const target = roster.find((r) => r.id === params.confirmedPlayerId)
    if (!target) {
      return { ok: false, error: "That roster match is no longer available. Ask your coach for help.", status: 409 }
    }
    const conf = scorePlayerMatch(target, input)
    if (conf === "none") {
      return { ok: false, error: "Confirmation could not be verified. Try again or contact support.", status: 400 }
    }
    return claimExistingPlayer(supabase, {
      playerId: target.id,
      userId: params.userId,
      teamId: params.teamId,
      email: params.email,
    })
  }

  if (params.intent === "auto") {
    if (decision.outcome !== "auto_claim" || !decision.autoPlayerId) {
      return {
        ok: false,
        error: "Automatic roster match is no longer available. Go back and confirm your details.",
        status: 409,
      }
    }
    return claimExistingPlayer(supabase, {
      playerId: decision.autoPlayerId,
      userId: params.userId,
      teamId: params.teamId,
      email: params.email,
    })
  }

  return { ok: false, error: "Invalid player join intent.", status: 400 }
}

export async function claimExistingPlayer(
  supabase: SupabaseClient,
  params: { playerId: string; userId: string; teamId: string; email: string }
): Promise<TeamJoinSignupResult> {
  const now = new Date().toISOString()
  const { data: updated, error } = await supabase
    .from("players")
    .update({
      user_id: params.userId,
      claimed_at: now,
      claim_status: "claimed",
      invite_status: "joined",
      email: params.email.trim().toLowerCase(),
    })
    .eq("id", params.playerId)
    .eq("team_id", params.teamId)
    .is("user_id", null)
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("[claimExistingPlayer]", error.message)
    return { ok: false, error: "Could not link to roster. Ask your coach for help.", status: 500 }
  }
  if (!updated?.id) {
    return { ok: false, error: "That roster spot was already claimed. Sign in or contact your coach.", status: 409 }
  }

  const { error: tmErr } = await upsertStaffTeamMember(supabase, params.teamId, params.userId, "player", {
    source: "player_team_join_claim",
  })
  if (tmErr) {
    console.error("[claimExistingPlayer] team_members", tmErr.message)
  }

  try {
    await notifyTeamStaff(supabase, params.teamId, {
      type: "roster_claim_completed",
      title: "Player linked to roster",
      body: "A player matched an existing roster spot and joined your team.",
      linkType: "player",
      linkId: params.playerId,
    })
  } catch {
    /* non-fatal */
  }

  return { ok: true, teamId: params.teamId, playerId: params.playerId, mode: "claimed_existing" }
}

export async function createSelfRegisteredPlayer(
  supabase: SupabaseClient,
  params: {
    teamId: string
    userId: string
    email: string
    firstName: string
    lastName: string
    graduationYear?: number | null
    jerseyNumber?: number | null
    dateOfBirth?: string | null
  }
): Promise<TeamJoinSignupResult> {
  const capacity = await assertCanAddActivePlayers(supabase, params.teamId, 1)
  if (!capacity.ok) {
    return {
      ok: false,
      error: capacity.message ?? "Roster limit reached. Ask your coach to upgrade or free a spot.",
      status: 402,
    }
  }

  const { data: inserted, error } = await supabase
    .from("players")
    .insert({
      team_id: params.teamId,
      first_name: params.firstName.trim(),
      last_name: params.lastName.trim(),
      email: params.email.trim().toLowerCase(),
      user_id: params.userId,
      graduation_year: params.graduationYear ?? null,
      jersey_number: params.jerseyNumber ?? null,
      date_of_birth: params.dateOfBirth ?? null,
      status: "active",
      claim_status: "pending_review",
      created_source: "player",
      self_registered: true,
      claimed_at: null,
      invite_status: "joined",
    })
    .select("id")
    .single()

  if (error || !inserted?.id) {
    console.error("[createSelfRegisteredPlayer]", error?.message)
    return { ok: false, error: "Could not create your roster profile. Try again or contact support.", status: 500 }
  }

  const playerId = inserted.id as string

  const { error: tmErr } = await upsertStaffTeamMember(supabase, params.teamId, params.userId, "player", {
    source: "player_team_join_self_reg",
  })
  if (tmErr) {
    console.error("[createSelfRegisteredPlayer] team_members", tmErr.message)
  }

  try {
    await notifyTeamStaff(supabase, params.teamId, {
      type: "roster_claim_pending",
      title: "Player signup needs review",
      body: `${params.firstName} ${params.lastName} joined with your team code and needs roster confirmation.`,
      linkType: "roster_review",
      linkId: playerId,
      metadata: { playerId, kind: "self_registered" },
    })
  } catch {
    /* non-fatal */
  }

  return { ok: true, teamId: params.teamId, playerId, mode: "created_self_registered" }
}
