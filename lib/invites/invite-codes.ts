/**
 * Typed invite codes: head_coach_team_invite, assistant_coach_invite, team_player_join, player_claim_invite, parent_link_invite.
 * Validation is by invite_type so one code cannot be used for the wrong flow.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export type InviteCodeType =
  | "head_coach_team_invite"
  | "assistant_coach_invite"
  | "team_player_join"
  | "player_claim_invite"
  | "parent_link_invite"
  | "athletic_director_link_invite"

export interface InviteCodeRecord {
  id: string
  code: string
  invite_type: InviteCodeType
  organization_id: string | null
  program_id: string | null
  team_id: string | null
  target_player_id: string | null
  uses: number
  max_uses: number | null
  expires_at: string | null
  is_active: boolean
}

function randomCode(length = 8): string {
  const { randomBytes } = require("crypto") as { randomBytes: (n: number) => Buffer }
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(length)
  let code = ""
  for (let i = 0; i < length; i++) code += chars[bytes[i] % chars.length]
  return code
}

/**
 * Find an active, non-expired invite code by code string and optional type(s).
 */
export async function findInviteCode(
  supabase: SupabaseClient,
  code: string,
  types?: InviteCodeType[]
): Promise<InviteCodeRecord | null> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return null

  let query = supabase
    .from("invite_codes")
    .select("id, code, invite_type, organization_id, program_id, team_id, target_player_id, uses, max_uses, expires_at, is_active")
    .eq("code", normalized)
    .eq("is_active", true)

  if (types?.length) {
    query = query.in("invite_type", types)
  }

  const { data, error } = await query.maybeSingle()
  if (error || !data) return null

  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : null
  if (expiresAt != null && expiresAt < Date.now()) return null

  return data as InviteCodeRecord
}

/**
 * Consume one use of an invite code and optionally set claimed_by and claimed_at.
 */
export async function consumeInviteCode(
  supabase: SupabaseClient,
  inviteCodeId: string,
  claimedByUserId: string
): Promise<{ error: string | null }> {
  const { data: row, error: fetchErr } = await supabase
    .from("invite_codes")
    .select("uses, max_uses")
    .eq("id", inviteCodeId)
    .single()

  if (fetchErr || !row) return { error: "Invite code not found" }

  const uses = Number(row.uses) ?? 0
  const maxUses = row.max_uses != null ? Number(row.max_uses) : null
  if (maxUses != null && uses >= maxUses) return { error: "Invite code has reached maximum uses" }

  const { error: updateErr } = await supabase
    .from("invite_codes")
    .update({
      uses: uses + 1,
      claimed_by_user_id: claimedByUserId,
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", inviteCodeId)

  if (updateErr) return { error: updateErr.message }
  return { error: null }
}

/**
 * Generate a unique code for invite_codes table (checks existing).
 */
export async function generateUniqueInviteCode(
  supabase: SupabaseClient,
  len = 8
): Promise<string> {
  for (let attempt = 0; attempt < 15; attempt++) {
    const code = randomCode(len)
    const { data } = await supabase
      .from("invite_codes")
      .select("id")
      .eq("code", code)
      .maybeSingle()
    if (!data) return code
  }
  return randomCode(len + 2)
}
