import type { SupabaseClient } from "@supabase/supabase-js"
import { findInviteCode } from "@/lib/invites/invite-codes"

/** Normalize player invite codes the same way signup and redeem do. */
export function normalizePlayerInviteCode(code: string): string {
  return code.trim().toUpperCase()
}

async function loadTeamDisplayName(supabase: SupabaseClient, teamId: string): Promise<string | null> {
  const { data } = await supabase.from("teams").select("name").eq("id", teamId).maybeSingle()
  if (!data || typeof (data as { name?: string }).name !== "string") return null
  const n = (data as { name: string }).name.trim()
  return n || null
}

export type ResolveParentAccessCodeResult =
  | {
      ok: true
      playerId: string
      playerDisplayName: string
      teamName: string | null
    }
  | { ok: false; error: string }

/**
 * Validates a parent link code for first-time parent signup and returns safe display fields.
 * Requires the athlete to have completed player signup (`players.user_id` set) and no existing parent link.
 */
export async function resolveParentAccessCodeForPreview(
  supabase: SupabaseClient,
  rawCode: string
): Promise<ResolveParentAccessCodeResult> {
  const normalized = normalizePlayerInviteCode(rawCode)
  if (!normalized) {
    return { ok: false, error: "Enter a parent link code." }
  }

  const { data: teamJoin } = await supabase.from("teams").select("id").eq("player_code", normalized).maybeSingle()
  if (teamJoin?.id) {
    return {
      ok: false,
      error:
        "That code is your team's shared join code. Enter your child's personal parent link code from the coach instead.",
    }
  }

  const typed = await findInviteCode(supabase, normalized, ["parent_link_invite"])
  type PreviewRow = {
    id: string
    team_id: string | null
    user_id: string | null
    first_name: string | null
    last_name: string | null
  }
  let playerRow: PreviewRow | null = null

  if (typed?.target_player_id) {
    const maxUses = typed.max_uses ?? Number.MAX_SAFE_INTEGER
    if (typed.uses >= maxUses) {
      return {
        ok: false,
        error: "This link code has already been used. Ask your coach for a new parent link code.",
      }
    }
    const { data: pl } = await supabase
      .from("players")
      .select("id, team_id, user_id, first_name, last_name")
      .eq("id", typed.target_player_id)
      .maybeSingle()
    if (pl?.team_id) {
      playerRow = pl as PreviewRow
    }
  }

  if (!playerRow) {
    const { data: pl } = await supabase
      .from("players")
      .select("id, team_id, user_id, first_name, last_name")
      .eq("invite_code", normalized)
      .maybeSingle()
    if (pl?.team_id) {
      playerRow = pl as PreviewRow
    }
  }

  if (!playerRow?.team_id) {
    return {
      ok: false,
      error: "That parent link code is not valid. Ask your coach for the code tied to your child's roster.",
    }
  }

  if (!playerRow.user_id) {
    return {
      ok: false,
      error:
        "Your athlete must finish creating their Braik player account before you can link with this code.",
    }
  }

  const { data: otherParentRows } = await supabase
    .from("parent_player_links")
    .select("id")
    .eq("player_id", playerRow.id)
    .limit(1)

  if (otherParentRows && otherParentRows.length > 0) {
    return {
      ok: false,
      error: "This player already has a linked parent account. Sign in instead.",
    }
  }

  const teamName = await loadTeamDisplayName(supabase, playerRow.team_id as string)
  const fn = typeof playerRow.first_name === "string" ? playerRow.first_name.trim() : ""
  const ln = typeof playerRow.last_name === "string" ? playerRow.last_name.trim() : ""
  const playerDisplayName = [fn, ln].filter(Boolean).join(" ").trim() || "This athlete"

  return {
    ok: true,
    playerId: playerRow.id,
    playerDisplayName,
    teamName,
  }
}

/**
 * Returns whether `code` matches a roster player's `players.invite_code` (coach-issued player code).
 * Does not expose player PII.
 */
export async function isValidParentSignupPlayerCode(
  supabase: SupabaseClient,
  code: string
): Promise<boolean> {
  const r = await resolveParentAccessCodeForPreview(supabase, code)
  return r.ok
}
