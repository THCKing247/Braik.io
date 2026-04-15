import type { SupabaseClient } from "@supabase/supabase-js"
import { getServerSession, type SessionUser } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { isFootballProgramSport } from "@/lib/enforcement/football-ad-access"
import { ROLES, type Role, canManageTeam, canEditRoster, canManageBilling, canPostAnnouncements, canViewPayments } from "./roles"
import { logPermissionDenial } from "@/lib/audit/structured-logger"

/** Thrown when membership lookup fails due to DB/schema error (callers should return 500, not 403). */
export class MembershipLookupError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = "MembershipLookupError"
  }
}

export type StaffStatus = "active" | "pending_assignment"

export interface UserMembership {
  userId: string
  teamId: string
  role: Role
  /** From team_members; omitted/undefined treated as active for legacy rows. */
  staffStatus?: StaffStatus
  /** JV/Freshman head (coach_assignments) may manage staff for their team level only. */
  delegatedTeamManage?: boolean
  /**
   * For `HEAD_COACH` rows from team_members: true when primary varsity HC (`is_primary` true or null).
   * False when JV/freshman head (`is_primary` false). Omitted for non-head roles.
   */
  isPrimaryHeadCoach?: boolean
  permissions?: unknown
  positionGroups?: unknown
}

/** Program-level membership from program_members. */
export interface ProgramMembership {
  userId: string
  programId: string
  role: "head_coach" | "director_of_football" | "assistant_coach" | "athletic_director"
}

const PROGRAM_HEAD_ROLES: ProgramMembership["role"][] = ["head_coach", "director_of_football"]

async function computeDelegatedTeamManage(
  supabase: SupabaseClient,
  userId: string,
  programId: string,
  teamLevel: string | null | undefined,
  normalizedRole: Role
): Promise<boolean> {
  if (normalizedRole !== ROLES.ASSISTANT_COACH) return false
  if (!teamLevel || (teamLevel !== "jv" && teamLevel !== "freshman")) return false

  const { data: rows, error } = await supabase
    .from("coach_assignments")
    .select("assignment_type")
    .eq("program_id", programId)
    .eq("user_id", userId)

  if (error || !rows?.length) return false

  const types = new Set(rows.map((r) => String((r as { assignment_type?: string }).assignment_type)))
  if (teamLevel === "jv" && types.has("jv_head")) return true
  if (teamLevel === "freshman" && types.has("freshman_head")) return true
  return false
}

/** Map profile.role (e.g. head_coach) to normalized Role (e.g. HEAD_COACH). */
export function profileRoleToNormalizedRole(profileRole: string | null | undefined): Role {
  const raw = (profileRole ?? "player").toString().trim().toLowerCase().replace(/-/g, "_")
  if (raw === "head_coach") return ROLES.HEAD_COACH
  if (raw === "assistant_coach") return ROLES.ASSISTANT_COACH
  if (raw === "athletic_director") return ROLES.ATHLETIC_DIRECTOR
  if (raw === "parent") return ROLES.PARENT
  if (raw === "school_admin" || raw === "admin") return ROLES.SCHOOL_ADMIN
  return ROLES.PLAYER
}

/** Map `team_members.role` (snake_case) to app Role for permissions. */
function teamMemberDbRoleToNormalizedRole(dbRole: string): Role {
  const r = dbRole.trim().toLowerCase().replace(/-/g, "_")
  if (r === "head_coach") return ROLES.HEAD_COACH
  if (r === "assistant_coach") return ROLES.ASSISTANT_COACH
  if (r === "team_admin" || r === "trainer" || r === "manager") return ROLES.ASSISTANT_COACH
  if (r === "player") return ROLES.PLAYER
  if (r === "parent") return ROLES.PARENT
  if (r === "school_admin") return ROLES.SCHOOL_ADMIN
  return profileRoleToNormalizedRole(dbRole)
}

/**
 * Program membership for a known user id (no session read). Used by team membership resolution
 * and after requireAuth to avoid a second getServerSession.
 */
export async function getProgramMembershipForUser(
  programId: string,
  userId: string
): Promise<ProgramMembership | null> {
  if (!userId) return null

  const supabase = getSupabaseServer()
  const { data: member, error } = await supabase
    .from("program_members")
    .select("program_id, user_id, role")
    .eq("program_id", programId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle()

  if (error) {
    console.error("[getProgramMembershipForUser] program_members lookup failed", {
      userId,
      programId,
      error,
    })
    throw new MembershipLookupError("Database error during program membership lookup", error)
  }

  if (
    !member ||
    !["head_coach", "director_of_football", "assistant_coach", "athletic_director"].includes(String(member.role))
  ) {
    return null
  }

  return {
    userId,
    programId: member.program_id,
    role: member.role as ProgramMembership["role"],
  }
}

/**
 * Resolve team membership for a known user id (no session read).
 * Same rules as getUserMembership but avoids a second getServerSession when the caller already authenticated.
 */
export async function getUserMembershipForUserId(teamId: string, userId: string): Promise<UserMembership | null> {
  if (!userId) return null

  const supabase = getSupabaseServer()

  const { data: teamMeta, error: teamError } = await supabase
    .from("teams")
    .select("created_by, program_id, team_level")
    .eq("id", teamId)
    .maybeSingle()

  if (teamError) {
    console.error("[getUserMembership] teams lookup failed", { userId, teamId, error: teamError })
    throw new MembershipLookupError("Database error during membership lookup", teamError)
  }

  const createdBy = (teamMeta as { created_by?: string } | null)?.created_by
  const programIdFromTeam = (teamMeta as { program_id?: string | null } | null)?.program_id ?? null
  const teamLevel = (teamMeta as { team_level?: string | null } | null)?.team_level ?? null

  const { data: tmRow, error: tmError } = await supabase
    .from("team_members")
    .select("role, staff_status, is_primary")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle()

  if (tmError) {
    console.error("[getUserMembership] team_members lookup failed", { userId, teamId, error: tmError })
    throw new MembershipLookupError("Database error during membership lookup", tmError)
  }

  const staffStatusFromRow: StaffStatus | undefined =
    tmRow && String((tmRow as { staff_status?: string }).staff_status || "") === "pending_assignment"
      ? "pending_assignment"
      : tmRow
        ? "active"
        : undefined

  async function withDelegation(
    role: Role,
    staffStatus: StaffStatus = "active",
    isPrimaryFromRow?: boolean | null
  ): Promise<UserMembership> {
    let delegatedTeamManage = false
    if (programIdFromTeam && role === ROLES.ASSISTANT_COACH) {
      delegatedTeamManage = await computeDelegatedTeamManage(supabase, userId, programIdFromTeam, teamLevel, role)
    }
    const isPrimaryHeadCoach =
      role === ROLES.HEAD_COACH ? isPrimaryFromRow !== false : undefined
    return {
      userId,
      teamId,
      role,
      staffStatus,
      delegatedTeamManage: delegatedTeamManage || undefined,
      isPrimaryHeadCoach,
      permissions: undefined,
      positionGroups: undefined,
    }
  }

  if (tmRow?.role) {
    const role = teamMemberDbRoleToNormalizedRole(String(tmRow.role))
    const ip = (tmRow as { is_primary?: boolean | null }).is_primary
    return withDelegation(role, staffStatusFromRow ?? "active", ip)
  }

  if (createdBy === userId) {
    return withDelegation(ROLES.HEAD_COACH, "active")
  }

  if (programIdFromTeam) {
    try {
      const programMembership = await getProgramMembershipForUser(programIdFromTeam, userId)
      if (
        programMembership &&
        ["head_coach", "director_of_football", "assistant_coach", "athletic_director"].includes(programMembership.role)
      ) {
        const role =
          programMembership.role === "head_coach" || programMembership.role === "director_of_football"
            ? ROLES.HEAD_COACH
            : programMembership.role === "assistant_coach"
              ? ROLES.ASSISTANT_COACH
              : ROLES.ATHLETIC_DIRECTOR
        return withDelegation(role, "active")
      }
    } catch (err) {
      if (err instanceof MembershipLookupError) throw err
      console.warn("[getUserMembership] program membership check failed", { userId, teamId, programId: programIdFromTeam, err })
    }
  }

  console.warn("[getUserMembership] no membership", {
    userId,
    teamId,
    teamCreatedBy: createdBy ?? null,
    programId: programIdFromTeam ?? null,
  })
  return null
}

/**
 * Get the current user's membership for a team:
 * - team_members (active) when present — source of truth for staff/roster linkage
 * - profiles.team_id + profiles.role
 * - teams.created_by (ownership / legacy creator access, not staff display)
 * - program_members for program-scoped coaches/AD
 */
export async function getUserMembership(teamId: string): Promise<UserMembership | null> {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return null
  }
  return getUserMembershipForUserId(teamId, session.user.id)
}

export async function requireAuth() {
  const session = await getServerSession()
  if (!session?.user?.id) {
    throw new Error("Unauthorized")
  }
  return session.user
}

export async function requireTeamAccess(teamId: string, requiredRole?: Role) {
  const user = await requireAuth()
  let membership: UserMembership | null
  try {
    membership = await getUserMembershipForUserId(teamId, user.id)
  } catch (err) {
    if (err instanceof MembershipLookupError) throw err
    throw err
  }

  if (!membership) {
    logPermissionDenial({
      userId: user.id,
      teamId,
      reason: "Not a member of this team",
    })
    throw new Error("Access denied: Not a member of this team")
  }

  if (requiredRole && membership.role !== requiredRole) {
    logPermissionDenial({
      userId: user.id,
      teamId,
      role: membership.role,
      requiredRole,
      reason: `Requires ${requiredRole} role, but user has ${membership.role}`,
    })
    throw new Error(`Access denied: Requires ${requiredRole} role`)
  }

  return { user, membership }
}

/**
 * Like requireTeamAccess but uses an already-loaded session user (avoids a second getServerSession).
 * Use when the route must call getServerSession first (e.g. applyRefreshedSessionCookies on token refresh).
 */
export async function requireTeamAccessWithUser(
  teamId: string,
  user: SessionUser,
  requiredRole?: Role
): Promise<{ user: SessionUser; membership: UserMembership }> {
  if (!user?.id) {
    throw new Error("Unauthorized")
  }
  let membership: UserMembership | null
  try {
    membership = await getUserMembershipForUserId(teamId, user.id)
  } catch (err) {
    if (err instanceof MembershipLookupError) throw err
    throw err
  }

  if (!membership) {
    logPermissionDenial({
      userId: user.id,
      teamId,
      reason: "Not a member of this team",
    })
    throw new Error("Access denied: Not a member of this team")
  }

  if (requiredRole && membership.role !== requiredRole) {
    logPermissionDenial({
      userId: user.id,
      teamId,
      role: membership.role,
      requiredRole,
      reason: `Requires ${requiredRole} role, but user has ${membership.role}`,
    })
    throw new Error(`Access denied: Requires ${requiredRole} role`)
  }

  return { user, membership }
}

export async function requireTeamPermission(
  teamId: string,
  permission: "manage" | "edit_roster" | "manage_billing" | "post_announcements" | "view_payments" | "edit_offense_plays" | "edit_defense_plays" | "edit_special_teams_plays",
  /** When set, skips a second getServerSession (caller already loaded session.user). */
  preAuthUser?: SessionUser
) {
  const { membership } = preAuthUser
    ? await requireTeamAccessWithUser(teamId, preAuthUser)
    : await requireTeamAccess(teamId)

  if (membership.staffStatus === "pending_assignment") {
    logPermissionDenial({
      userId: membership.userId,
      teamId,
      role: membership.role,
      requiredPermission: permission,
      reason: "Staff assignment pending approval",
    })
    throw new Error("Access denied: Staff assignment pending approval")
  }

  const delegated = Boolean(membership.delegatedTeamManage)

  const allowed = (() => {
    switch (permission) {
      case "manage":
        return canManageTeam(membership.role) || delegated
      case "edit_roster":
      case "edit_offense_plays":
      case "edit_defense_plays":
      case "edit_special_teams_plays":
        return canEditRoster(membership.role)
      case "manage_billing":
        return canManageBilling(membership.role)
      case "post_announcements":
        return canPostAnnouncements(membership.role) && !delegated
      case "view_payments":
        return canViewPayments(membership.role)
      default:
        return false
    }
  })()

  if (!allowed) {
    logPermissionDenial({
      userId: membership.userId,
      teamId,
      role: membership.role,
      requiredPermission: permission,
      reason: `Insufficient permissions for ${permission}`,
    })
    throw new Error(`Access denied: Insufficient permissions for ${permission}`)
  }

  return { membership }
}

/**
 * Get the current user's program-level role from program_members.
 * Used for program-scoped actions (promotions, program depth chart, evaluations, play assignments).
 */
export async function getProgramMembership(programId: string): Promise<ProgramMembership | null> {
  const session = await getServerSession()
  if (!session?.user?.id) return null
  return getProgramMembershipForUser(programId, session.user.id)
}

/** Require the user to be a coach (head_coach or assistant_coach) in the program. */
export async function requireProgramCoach(programId: string): Promise<{ user: { id: string }; membership: ProgramMembership }> {
  const user = await requireAuth()
  let membership: ProgramMembership | null
  try {
    membership = await getProgramMembershipForUser(programId, user.id)
  } catch (err) {
    if (err instanceof MembershipLookupError) throw err
    throw err
  }

  const coachRoles: ProgramMembership["role"][] = ["head_coach", "director_of_football", "assistant_coach"]
  if (!membership || !coachRoles.includes(membership.role)) {
    logPermissionDenial({
      userId: user.id,
      teamId: programId,
      reason: "Not a coach in this program",
    })
    throw new Error("Access denied: Not a coach in this program")
  }

  return { user, membership }
}

/** Require the user to be head coach in the program (e.g. for promotions). */
export async function requireProgramHeadCoach(programId: string): Promise<{ user: { id: string }; membership: ProgramMembership }> {
  const user = await requireAuth()
  let membership: ProgramMembership | null
  try {
    membership = await getProgramMembership(programId)
  } catch (err) {
    if (err instanceof MembershipLookupError) throw err
    throw err
  }

  if (!membership || !PROGRAM_HEAD_ROLES.includes(membership.role)) {
    logPermissionDenial({
      userId: user.id,
      teamId: programId,
      reason: "Head coach required for this action",
    })
    throw new Error("Access denied: Head coach required")
  }

  return { user, membership }
}

/**
 * List program teams for roster UI (e.g. promotion dropdown). Allows program coaches (not `athletic_director`
 * program role) and team-level head/assistant coaches without a `program_members` row (legacy / team-scoped).
 */
export async function requireProgramTeamsListAccess(programId: string): Promise<{ user: { id: string } }> {
  const user = await requireAuth()
  const supabase = getSupabaseServer()

  const { data: pm, error: pmErr } = await supabase
    .from("program_members")
    .select("role")
    .eq("program_id", programId)
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle()

  if (pmErr) {
    console.error("[requireProgramTeamsListAccess] program_members", pmErr)
    throw new MembershipLookupError("Database error during program membership lookup", pmErr)
  }

  const pmRole = (pm?.role as string | undefined) ?? ""
  if (pmRole === "head_coach" || pmRole === "assistant_coach") {
    return { user }
  }

  const { data: programTeams, error: tErr } = await supabase.from("teams").select("id").eq("program_id", programId)
  if (tErr) {
    console.error("[requireProgramTeamsListAccess] teams", tErr)
    throw new MembershipLookupError("Database error listing program teams", tErr)
  }
  const teamIds = (programTeams ?? []).map((r) => (r as { id: string }).id)
  if (teamIds.length === 0) {
    logPermissionDenial({ userId: user.id, teamId: programId, reason: "No teams in program" })
    throw new Error("Access denied")
  }

  const { data: tm, error: tmErr } = await supabase
    .from("team_members")
    .select("id")
    .in("team_id", teamIds)
    .eq("user_id", user.id)
    .eq("active", true)
    .in("role", ["head_coach", "assistant_coach"])
    .limit(1)

  if (tmErr) {
    console.error("[requireProgramTeamsListAccess] team_members", tmErr)
    throw new MembershipLookupError("Database error during team membership lookup", tmErr)
  }

  if (tm && tm.length > 0) {
    return { user }
  }

  logPermissionDenial({
    userId: user.id,
    teamId: programId,
    reason: "Not a coach with access to this program's teams",
  })
  throw new Error("Access denied: Not a coach in this program")
}

/**
 * Phase 7: move players between football team levels within one program. Head coach via `program_members` or
 * primary head coach (`team_members` head_coach with is_primary !== false) on any program team.
 * Does not grant access via `athletic_director` program role (AD portal is separate).
 */
export async function requireProgramFootballPlayerReassignmentAuthority(
  programId: string
): Promise<{ user: { id: string } }> {
  const user = await requireAuth()
  const supabase = getSupabaseServer()

  const { data: program, error: progErr } = await supabase
    .from("programs")
    .select("id, sport")
    .eq("id", programId)
    .maybeSingle()

  if (progErr) {
    console.error("[requireProgramFootballPlayerReassignmentAuthority] programs", progErr)
    throw new MembershipLookupError("Database error loading program", progErr)
  }
  if (!program) {
    logPermissionDenial({ userId: user.id, teamId: programId, reason: "Program not found" })
    throw new Error("Access denied")
  }

  if (!isFootballProgramSport((program as { sport?: string | null }).sport)) {
    logPermissionDenial({
      userId: user.id,
      teamId: programId,
      reason: "Player level reassignment is only for football programs",
    })
    throw new Error("Access denied: Player level moves are only supported for football programs")
  }

  const { data: pm, error: pmErr } = await supabase
    .from("program_members")
    .select("role")
    .eq("program_id", programId)
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle()

  if (pmErr) {
    console.error("[requireProgramFootballPlayerReassignmentAuthority] program_members", pmErr)
    throw new MembershipLookupError("Database error during program membership lookup", pmErr)
  }

  if ((pm?.role as string | undefined) === "head_coach") {
    return { user }
  }

  const { data: programTeams, error: tErr } = await supabase.from("teams").select("id").eq("program_id", programId)
  if (tErr) {
    console.error("[requireProgramFootballPlayerReassignmentAuthority] teams", tErr)
    throw new MembershipLookupError("Database error listing program teams", tErr)
  }
  const teamIds = (programTeams ?? []).map((r) => (r as { id: string }).id)
  if (teamIds.length === 0) {
    logPermissionDenial({ userId: user.id, teamId: programId, reason: "No teams in program" })
    throw new Error("Access denied")
  }

  const { data: headRows, error: tmErr } = await supabase
    .from("team_members")
    .select("id, is_primary")
    .in("team_id", teamIds)
    .eq("user_id", user.id)
    .eq("active", true)
    .eq("role", "head_coach")

  if (tmErr) {
    console.error("[requireProgramFootballPlayerReassignmentAuthority] team_members", tmErr)
    throw new MembershipLookupError("Database error during team membership lookup", tmErr)
  }

  const hasHeadSeat = (headRows ?? []).some((row) => {
    const ip = (row as { is_primary?: boolean | null }).is_primary
    return ip !== false
  })
  if (hasHeadSeat) {
    return { user }
  }

  logPermissionDenial({
    userId: user.id,
    teamId: programId,
    reason: "Head coach authority required for roster moves between levels",
  })
  throw new Error("Access denied: Head coach required for this action")
}

/**
 * Program placement admin: move assistants between program teams + JV/Freshman head designations.
 *
 * Primary truth: `director_of_football` or `athletic_director`.
 * Non-football: `head_coach` retains placement powers (unchanged).
 * Football + `head_coach`: only while `programs.created_by_user_id` is null (LEGACY_TRANSITION) or equals this user.
 */
export async function requireProgramStaffAdmin(programId: string): Promise<{ user: { id: string }; membership: ProgramMembership }> {
  const user = await requireAuth()
  let membership: ProgramMembership | null
  try {
    membership = await getProgramMembership(programId)
  } catch (err) {
    if (err instanceof MembershipLookupError) throw err
    throw err
  }

  const allowed: ProgramMembership["role"][] = ["head_coach", "director_of_football", "athletic_director"]
  if (!membership || !allowed.includes(membership.role)) {
    logPermissionDenial({
      userId: user.id,
      teamId: programId,
      reason: "Program staff admin required",
    })
    throw new Error("Access denied: Program staff admin required")
  }

  if (membership.role === "athletic_director" || membership.role === "director_of_football") {
    return { user, membership }
  }

  const supabase = getSupabaseServer()
  const { data: prog, error: progErr } = await supabase
    .from("programs")
    .select("sport, created_by_user_id")
    .eq("id", programId)
    .maybeSingle()

  if (progErr) {
    console.error("[requireProgramStaffAdmin] program lookup", progErr)
    throw new MembershipLookupError("Database error during program lookup", progErr)
  }

  const sportRaw = String((prog as { sport?: string | null } | null)?.sport ?? "")
    .trim()
    .toLowerCase()
  const isFootball = sportRaw === "" || sportRaw === "football"
  if (!isFootball) {
    return { user, membership }
  }

  const creatorId = (prog as { created_by_user_id?: string | null } | null)?.created_by_user_id ?? null
  if (creatorId === null || creatorId === user.id) {
    return { user, membership }
  }

  logPermissionDenial({
    userId: user.id,
    teamId: programId,
    reason: "Football program placement requires director or program owner",
  })
  throw new Error("Access denied: Program staff admin required")
}
