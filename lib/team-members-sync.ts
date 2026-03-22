import type { SupabaseClient } from "@supabase/supabase-js"

/** Values allowed for staff-facing `team_members.role` (snake_case). */
export const TEAM_MEMBER_STAFF_ROLES = [
  "head_coach",
  "assistant_coach",
  "team_admin",
  "trainer",
  "manager",
] as const

export type TeamMemberStaffRole = (typeof TEAM_MEMBER_STAFF_ROLES)[number]

/** Roster / org roles still stored in team_members for messaging and membership repair. */
export const TEAM_MEMBER_OTHER_ROLES = ["player", "parent", "school_admin"] as const

export function logTeamMembersAudit(
  event: string,
  payload: Record<string, unknown>
): void {
  console.warn(`[team_members_audit] ${event}`, JSON.stringify(payload))
}

/** Structured log for membership writes (search: `[team_members_write]`). */
export function logTeamMembershipWrite(payload: {
  event: string
  team_id: string
  user_id: string
  role: string
  is_primary: boolean
  head_coach_user_id_synced: boolean
  source?: string
}): void {
  console.info(
    "[team_members_write]",
    JSON.stringify({
      ...payload,
      ts: new Date().toISOString(),
    })
  )
}

/**
 * When there is no primary head_coach row but `teams` has denormalized pointers, backfill safely.
 * Order: `head_coach_user_id` first, then `created_by` (last resort; audit / legacy creator).
 */
export async function repairPrimaryHeadCoachFromDenormalizedFields(
  supabase: SupabaseClient,
  teamId: string
): Promise<{ repaired: boolean; source: "head_coach_user_id" | "created_by" | "none" }> {
  const { data: team } = await supabase
    .from("teams")
    .select("head_coach_user_id, created_by")
    .eq("id", teamId)
    .maybeSingle()

  const { data: primaryRow } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("role", "head_coach")
    .eq("active", true)
    .eq("is_primary", true)
    .maybeSingle()

  if (primaryRow?.user_id) {
    return { repaired: false, source: "none" }
  }

  const hc = (team as { head_coach_user_id?: string | null } | null)?.head_coach_user_id
  if (hc) {
    const { error } = await setPrimaryHeadCoach(supabase, teamId, hc, {
      source: "repair_head_coach_user_id",
      skipStructuredLog: true,
    })
    if (!error) {
      logTeamMembersAudit("repair.primary_hc_from_head_coach_user_id", { teamId, userId: hc })
      logTeamMembershipWrite({
        event: "repair_primary_head_coach",
        team_id: teamId,
        user_id: hc,
        role: "head_coach",
        is_primary: true,
        head_coach_user_id_synced: true,
        source: "repair_head_coach_user_id",
      })
      return { repaired: true, source: "head_coach_user_id" }
    }
  }

  const createdBy = (team as { created_by?: string | null } | null)?.created_by
  if (createdBy) {
    const { error } = await setPrimaryHeadCoach(supabase, teamId, createdBy, {
      source: "repair_created_by",
      skipStructuredLog: true,
    })
    if (!error) {
      logTeamMembersAudit("repair.primary_hc_from_created_by", { teamId, userId: createdBy })
      logTeamMembershipWrite({
        event: "repair_primary_head_coach",
        team_id: teamId,
        user_id: createdBy,
        role: "head_coach",
        is_primary: true,
        head_coach_user_id_synced: true,
        source: "repair_created_by",
      })
      return { repaired: true, source: "created_by" }
    }
  }

  return { repaired: false, source: "none" }
}

/**
 * Set the single primary head coach for a team and sync `teams.head_coach_user_id`.
 */
export async function setPrimaryHeadCoach(
  supabase: SupabaseClient,
  teamId: string,
  userId: string,
  opts?: { source?: string; skipStructuredLog?: boolean }
): Promise<{ error: { message: string } | null }> {
  const { error: clearErr } = await supabase
    .from("team_members")
    .update({ is_primary: false })
    .eq("team_id", teamId)
    .eq("role", "head_coach")

  if (clearErr) {
    return { error: clearErr }
  }

  const { error: upErr } = await supabase.from("team_members").upsert(
    {
      team_id: teamId,
      user_id: userId,
      role: "head_coach",
      active: true,
      is_primary: true,
    },
    { onConflict: "team_id,user_id" }
  )
  if (upErr) {
    return { error: upErr }
  }

  const { error: teamErr } = await supabase
    .from("teams")
    .update({ head_coach_user_id: userId })
    .eq("id", teamId)

  if (teamErr) {
    return { error: teamErr }
  }

  if (!opts?.skipStructuredLog) {
    logTeamMembershipWrite({
      event: "set_primary_head_coach",
      team_id: teamId,
      user_id: userId,
      role: "head_coach",
      is_primary: true,
      head_coach_user_id_synced: true,
      source: opts?.source,
    })
  }

  return { error: null }
}

/**
 * Upsert a non-primary staff row (assistant_coach, team_admin, trainer, manager).
 */
export async function upsertStaffTeamMember(
  supabase: SupabaseClient,
  teamId: string,
  userId: string,
  role: TeamMemberStaffRole | "player" | "parent",
  opts?: { active?: boolean; source?: string; skipStructuredLog?: boolean }
): Promise<{ error: { message: string } | null }> {
  const active = opts?.active ?? true
  if (role === "head_coach") {
    return { error: { message: "Use setPrimaryHeadCoach for head_coach" } }
  }

  const payload: Record<string, unknown> = {
    team_id: teamId,
    user_id: userId,
    role,
    active,
    is_primary: false,
  }

  const { error } = await supabase.from("team_members").upsert(payload, {
    onConflict: "team_id,user_id",
  })
  if (!error && !opts?.skipStructuredLog) {
    logTeamMembershipWrite({
      event: "upsert_staff_or_roster",
      team_id: teamId,
      user_id: userId,
      role,
      is_primary: false,
      head_coach_user_id_synced: false,
      source: opts?.source,
    })
  }
  return { error: error ?? null }
}

/** Map profile / invite role string to team_members.role */
export function profileRoleToTeamMemberRole(
  profileRole: string | null | undefined
): "head_coach" | "assistant_coach" | "player" | "parent" | "team_admin" {
  const r = (profileRole ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
  if (r === "head_coach") return "head_coach"
  if (r === "assistant_coach") return "assistant_coach"
  if (r === "parent") return "parent"
  if (r === "school_admin" || r === "admin") return "team_admin"
  return "player"
}
