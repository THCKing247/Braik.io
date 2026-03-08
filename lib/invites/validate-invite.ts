import type { SupabaseClient } from "@supabase/supabase-js"

export type InviteValidation =
  | { valid: true; invite: InviteRecord; team: TeamRecord }
  | { valid: false; reason: "not_found" | "expired" | "already_accepted" | "team_missing" }

export type InviteRecord = {
  id: string
  email: string
  role: string
  team_id: string
  token: string
  expires_at: string
  accepted_at: string | null
}

export type TeamRecord = {
  id: string
  name: string
  sport: string | null
}

/**
 * Validate an invite by id. Returns invite + team if valid, or a reason if invalid.
 */
export async function validateInviteById(
  supabase: SupabaseClient,
  inviteId: string
): Promise<InviteValidation> {
  const { data: invite, error: inviteError } = await supabase
    .from("invites")
    .select("id, email, role, team_id, token, expires_at, accepted_at")
    .eq("id", inviteId)
    .maybeSingle()

  if (inviteError || !invite) {
    return { valid: false, reason: "not_found" }
  }

  if (invite.accepted_at) {
    return { valid: false, reason: "already_accepted" }
  }

  const expiresAt = new Date(invite.expires_at)
  if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
    return { valid: false, reason: "expired" }
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name, sport")
    .eq("id", invite.team_id)
    .maybeSingle()

  if (teamError || !team) {
    return { valid: false, reason: "team_missing" }
  }

  return {
    valid: true,
    invite: invite as InviteRecord,
    team: team as TeamRecord,
  }
}

/**
 * Validate an invite by token (for signup-with-invite flow).
 */
export async function validateInviteByToken(
  supabase: SupabaseClient,
  token: string
): Promise<InviteValidation> {
  const { data: invite, error: inviteError } = await supabase
    .from("invites")
    .select("id, email, role, team_id, token, expires_at, accepted_at")
    .eq("token", token)
    .maybeSingle()

  if (inviteError || !invite) {
    return { valid: false, reason: "not_found" }
  }

  if (invite.accepted_at) {
    return { valid: false, reason: "already_accepted" }
  }

  const expiresAt = new Date(invite.expires_at)
  if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
    return { valid: false, reason: "expired" }
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("id, name, sport")
    .eq("id", invite.team_id)
    .maybeSingle()

  if (teamError || !team) {
    return { valid: false, reason: "team_missing" }
  }

  return {
    valid: true,
    invite: invite as InviteRecord,
    team: team as TeamRecord,
  }
}
