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

/**
 * Every value allowed in `public.team_members.role` (DB check: team_members_role_check).
 * Keep in sync with supabase/migrations/*team_members_role_check*.sql
 */
export const TEAM_MEMBERS_DB_ROLES = [
  "head_coach",
  "assistant_coach",
  "director_of_football",
  "athletic_director",
  "team_admin",
  "trainer",
  "manager",
  "player",
  "parent",
  "school_admin",
] as const

export type TeamMembersDbRole = (typeof TEAM_MEMBERS_DB_ROLES)[number]

const TEAM_MEMBERS_DB_ROLE_SET = new Set<string>(TEAM_MEMBERS_DB_ROLES as readonly string[])

/** Normalize casing/spacing before insert; returns null if the token cannot map to a DB role. */
export function normalizeRoleTokenForTeamMembers(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null
  const t = raw.trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_")
  return t.length > 0 ? t : null
}

/** True when `role` is allowed on `team_members` (matches team_members_role_check). */
export function isTeamMembersDbRole(role: string | null | undefined): role is TeamMembersDbRole {
  const n = normalizeRoleTokenForTeamMembers(role)
  return n != null && TEAM_MEMBERS_DB_ROLE_SET.has(n)
}

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
      staff_status: "active",
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
  role: TeamMemberStaffRole | "player" | "parent" | "school_admin" | string,
  opts?: {
    active?: boolean
    source?: string
    skipStructuredLog?: boolean
    /** Default active. Assistant coaches joining via code start pending until a head assigns them. */
    staffStatus?: "active" | "pending_assignment"
  }
): Promise<{ error: { message: string } | null }> {
  const active = opts?.active ?? true
  const roleToken = normalizeRoleTokenForTeamMembers(String(role))
  if (!roleToken || roleToken === "head_coach") {
    if (roleToken === "head_coach") {
      return { error: { message: "Use setPrimaryHeadCoach for head_coach" } }
    }
    console.error("[upsertStaffTeamMember] invalid role token", {
      handler: "upsertStaffTeamMember",
      roleInput: role,
      teamId,
      userId,
      source: opts?.source,
    })
    return { error: { message: "Invalid team member role" } }
  }

  if (!isTeamMembersDbRole(roleToken)) {
    console.error("[upsertStaffTeamMember] role not allowed by team_members_role_check", {
      handler: "upsertStaffTeamMember",
      roleNormalized: roleToken,
      teamId,
      userId,
      source: opts?.source,
      allowed: TEAM_MEMBERS_DB_ROLES,
    })
    return { error: { message: "Invalid team member role" } }
  }

  const staffStatus = opts?.staffStatus ?? "active"

  const payload: Record<string, unknown> = {
    team_id: teamId,
    user_id: userId,
    role: roleToken,
    active,
    is_primary: false,
    staff_status: staffStatus,
  }

  const updateFields = {
    role: roleToken,
    active,
    is_primary: false,
    staff_status: staffStatus,
  }

  const minimalInsert: Record<string, unknown> = {
    team_id: teamId,
    user_id: userId,
    role: roleToken,
    active,
  }

  // Prefer PostgREST upsert (handles insert-or-update on PK). Fall back if client/DB rejects.
  let { error } = await supabase.from("team_members").upsert(payload, {
    onConflict: "team_id,user_id",
  })

  if (error) {
    const errCode = String((error as { code?: string }).code ?? "")
    const msg = (error.message ?? "").toLowerCase()
    const maybeMissingOptionalCol =
      errCode === "42703" || (msg.includes("column") && msg.includes("does not exist"))

    if (maybeMissingOptionalCol) {
      const res = await supabase.from("team_members").upsert(
        { ...minimalInsert, is_primary: false },
        { onConflict: "team_id,user_id" }
      )
      error = res.error
    }
  }

  if (error) {
    const { data: existing } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .maybeSingle()

    if (existing) {
      error = (await supabase.from("team_members").update(updateFields).eq("team_id", teamId).eq("user_id", userId)).error
    } else {
      let ins = await supabase.from("team_members").insert(payload)
      error = ins.error
      if (error) {
        const msg = (error.message ?? "").toLowerCase()
        const code = String((error as { code?: string }).code ?? "")
        if (code === "42703" || (msg.includes("column") && msg.includes("does not exist"))) {
          ins = await supabase.from("team_members").insert(minimalInsert)
          error = ins.error
        }
      }
      if (error) {
        const msg = (error.message ?? "").toLowerCase()
        const isDup =
          msg.includes("duplicate") ||
          msg.includes("unique") ||
          (error as { code?: string }).code === "23505"
        if (isDup) {
          error = (await supabase.from("team_members").update(updateFields).eq("team_id", teamId).eq("user_id", userId))
            .error
        }
      }
    }
  }

  if (!error && !opts?.skipStructuredLog) {
    logTeamMembershipWrite({
      event: "upsert_staff_or_roster",
      team_id: teamId,
      user_id: userId,
      role: roleToken,
      is_primary: false,
      head_coach_user_id_synced: false,
      source: opts?.source,
    })
  }
  return { error: error ?? null }
}

/**
 * Map profile / signup role string to a `team_members.role` value (snake_case, check-constraint safe).
 * Stale / legacy tokens (athlete, member, guardian) map to roster-safe roles.
 */
export function profileRoleToTeamMemberRole(
  profileRole: string | null | undefined
): TeamMembersDbRole {
  const r = (profileRole ?? "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, "_")
  if (r === "head_coach") return "head_coach"
  if (r === "assistant_coach") return "assistant_coach"
  if (r === "director_of_football") return "director_of_football"
  if (r === "athletic_director") return "athletic_director"
  if (r === "team_admin") return "team_admin"
  if (r === "trainer") return "trainer"
  if (r === "manager") return "manager"
  if (r === "parent") return "parent"
  if (r === "admin") return "team_admin"
  if (r === "school_admin") return "school_admin"
  if (r === "athlete" || r === "member") return "player"
  if (r === "guardian") return "parent"
  return "player"
}
