import type { SupabaseClient } from "@supabase/supabase-js"
import { findInviteCode } from "@/lib/invites/invite-codes"
import { normalizePlayerInviteCode } from "@/lib/parent-player-code"
import { normalizePlayerJoinCode } from "@/lib/players/join-code-normalize"
import { resolveTeamByPlayerJoinCode } from "@/lib/players/player-claim"

export type PlayerJoinEntryErrorCode =
  | "invalid_team_code"
  | "invalid_player_code"
  | "expired_player_invite"
  | "player_already_claimed"
  | "invite_max_uses"
  | "player_code_is_team_code"
  | "both_provided"
  | "missing_code"

export type ResolvePlayerJoinEntryOk =
  | { ok: true; kind: "team"; teamName: string | null }
  | {
      ok: true
      kind: "player_invite"
      teamName: string | null
      playerFirstName: string | null
      playerLastName: string | null
      jerseyNumber: number | null
      graduationYear: number | null
    }

export type ResolvePlayerJoinEntryResult =
  | ResolvePlayerJoinEntryOk
  | { ok: false; code: PlayerJoinEntryErrorCode; message: string }

async function loadTeamName(supabase: SupabaseClient, teamId: string): Promise<string | null> {
  const { data } = await supabase.from("teams").select("name").eq("id", teamId).maybeSingle()
  if (!data || typeof (data as { name?: string }).name !== "string") return null
  const n = (data as { name: string }).name.trim()
  return n || null
}

/**
 * Resolves a coach-issued player invite code (players.invite_code + invite_codes.player_claim_invite).
 * When `rejectIfMatchesTeamJoinCode` is true and the string matches teams.player_code, returns
 * player_code_is_team_code so the UI can direct users to the team field.
 */
export async function resolvePlayerInviteJoinEntry(
  supabase: SupabaseClient,
  rawCode: string,
  options: { rejectIfMatchesTeamJoinCode: boolean }
): Promise<ResolvePlayerJoinEntryResult> {
  const code = normalizePlayerInviteCode(rawCode)
  if (!code) {
    return { ok: false, code: "invalid_player_code", message: "Enter a player invite code." }
  }

  const { data: teamRow } = await supabase.from("teams").select("id").eq("player_code", code).maybeSingle()
  if (teamRow?.id && options.rejectIfMatchesTeamJoinCode) {
    return {
      ok: false,
      code: "player_code_is_team_code",
      message: "That is your team’s shared join code. Enter it under Team join code, not Player code.",
    }
  }

  const { data: inviteRow } = await supabase
    .from("player_invites")
    .select("id, player_id, status, expires_at")
    .eq("code", code)
    .in("status", ["pending", "sent"])
    .maybeSingle()

  if (inviteRow) {
    const expRaw = (inviteRow as { expires_at?: string | null }).expires_at
    if (expRaw) {
      const exp = new Date(expRaw)
      if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        return {
          ok: false,
          code: "expired_player_invite",
          message: "This player invite has expired. Ask your coach for a new code or link.",
        }
      }
    }

    const playerId = (inviteRow as { player_id: string }).player_id
    const { data: pl } = await supabase
      .from("players")
      .select("first_name, last_name, jersey_number, graduation_year, user_id, team_id")
      .eq("id", playerId)
      .maybeSingle()

    if (pl?.user_id) {
      return {
        ok: false,
        code: "player_already_claimed",
        message: "This roster spot is already linked to an account. Sign in or ask your coach for help.",
      }
    }
    if (pl?.team_id) {
      const teamName = await loadTeamName(supabase, pl.team_id as string)
      return {
        ok: true,
        kind: "player_invite",
        teamName,
        playerFirstName:
          typeof (pl as { first_name?: string }).first_name === "string"
            ? (pl as { first_name: string }).first_name.trim() || null
            : null,
        playerLastName:
          typeof (pl as { last_name?: string }).last_name === "string"
            ? (pl as { last_name: string }).last_name.trim() || null
            : null,
        jerseyNumber:
          typeof (pl as { jersey_number?: number | null }).jersey_number === "number"
            ? (pl as { jersey_number: number }).jersey_number
            : null,
        graduationYear:
          typeof (pl as { graduation_year?: number | null }).graduation_year === "number"
            ? (pl as { graduation_year: number }).graduation_year
            : null,
      }
    }
  }

  const typed = await findInviteCode(supabase, code, ["player_claim_invite"])
  if (typed) {
    const maxUses = typed.max_uses ?? Number.MAX_SAFE_INTEGER
    if (typed.uses >= maxUses) {
      return {
        ok: false,
        code: "invite_max_uses",
        message: "This invite code has already been used. Ask your coach for a new invite.",
      }
    }
    const targetId = typed.target_player_id
    if (!targetId) {
      return { ok: false, code: "invalid_player_code", message: "That player invite code is not valid." }
    }
    const { data: pl } = await supabase
      .from("players")
      .select("first_name, last_name, jersey_number, graduation_year, user_id, team_id")
      .eq("id", targetId)
      .maybeSingle()

    if (!pl?.team_id) {
      return { ok: false, code: "invalid_player_code", message: "That player invite code is not valid." }
    }
    if (pl.user_id) {
      return {
        ok: false,
        code: "player_already_claimed",
        message: "This roster spot is already linked to an account. Sign in or ask your coach for help.",
      }
    }

    const teamName = await loadTeamName(supabase, pl.team_id as string)
    return {
      ok: true,
      kind: "player_invite",
      teamName,
      playerFirstName:
        typeof pl.first_name === "string" ? pl.first_name.trim() || null : null,
      playerLastName: typeof pl.last_name === "string" ? pl.last_name.trim() || null : null,
      jerseyNumber: typeof pl.jersey_number === "number" ? pl.jersey_number : null,
      graduationYear: typeof pl.graduation_year === "number" ? pl.graduation_year : null,
    }
  }

  const { data: pl2 } = await supabase
    .from("players")
    .select("first_name, last_name, jersey_number, graduation_year, user_id, team_id")
    .eq("invite_code", code)
    .maybeSingle()

  if (!pl2?.team_id) {
    return {
      ok: false,
      code: "invalid_player_code",
      message: "That player invite code is not valid. Double-check the code from your coach.",
    }
  }
  if (pl2.user_id) {
    return {
      ok: false,
      code: "player_already_claimed",
      message: "This roster spot is already linked to an account. Sign in or ask your coach for help.",
    }
  }

  const teamName = await loadTeamName(supabase, pl2.team_id as string)
  return {
    ok: true,
    kind: "player_invite",
    teamName,
    playerFirstName:
      typeof pl2.first_name === "string" ? pl2.first_name.trim() || null : null,
    playerLastName: typeof pl2.last_name === "string" ? pl2.last_name.trim() || null : null,
    jerseyNumber: typeof pl2.jersey_number === "number" ? pl2.jersey_number : null,
    graduationYear: typeof pl2.graduation_year === "number" ? pl2.graduation_year : null,
  }
}

export async function resolveTeamJoinEntryOnly(
  supabase: SupabaseClient,
  rawCode: string
): Promise<ResolvePlayerJoinEntryResult> {
  const joinCode = normalizePlayerJoinCode(rawCode)
  if (!joinCode) {
    return { ok: false, code: "invalid_team_code", message: "Enter a team join code." }
  }
  const resolved = await resolveTeamByPlayerJoinCode(supabase, joinCode)
  if (!resolved) {
    return {
      ok: false,
      code: "invalid_team_code",
      message:
        "That team join code is not valid. Check with your coach, or use your personal player invite code in the Player code field.",
    }
  }
  return { ok: true, kind: "team", teamName: resolved.teamName }
}

/**
 * For URL ?code=... — try team join code first, then player invite (same string is unlikely).
 */
export async function resolveAmbiguousJoinCode(
  supabase: SupabaseClient,
  rawCode: string
): Promise<ResolvePlayerJoinEntryResult> {
  const normalized = normalizePlayerJoinCode(rawCode)
  if (!normalized) {
    return { ok: false, code: "missing_code", message: "Enter a code." }
  }

  const teamTry = await resolveTeamByPlayerJoinCode(supabase, normalized)
  if (teamTry) {
    return { ok: true, kind: "team", teamName: teamTry.teamName }
  }

  return resolvePlayerInviteJoinEntry(supabase, normalized, { rejectIfMatchesTeamJoinCode: false })
}
