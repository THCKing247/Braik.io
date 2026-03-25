import type { SupabaseClient } from "@supabase/supabase-js"

/** Normalize player invite codes the same way signup and redeem do. */
export function normalizePlayerInviteCode(code: string): string {
  return code.trim().toUpperCase()
}

/**
 * Returns whether `code` matches a roster player's `players.invite_code` (coach-issued player code).
 * Does not expose player PII.
 */
export async function isValidParentSignupPlayerCode(
  supabase: SupabaseClient,
  code: string
): Promise<boolean> {
  const normalized = normalizePlayerInviteCode(code)
  if (!normalized) return false

  const { data: teamJoin } = await supabase.from("teams").select("id").eq("player_code", normalized).maybeSingle()
  if (teamJoin?.id) {
    return false
  }

  const { data: row } = await supabase
    .from("players")
    .select("id")
    .eq("invite_code", normalized)
    .maybeSingle()

  return Boolean(row?.id)
}
