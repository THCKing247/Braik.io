import { getServerSession } from "@/lib/auth/server-auth"
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

export interface UserMembership {
  userId: string
  teamId: string
  role: Role
  permissions?: unknown
  positionGroups?: unknown
}

/** Program-level membership from program_members (head_coach, assistant_coach, athletic_director). */
export interface ProgramMembership {
  userId: string
  programId: string
  role: "head_coach" | "assistant_coach" | "athletic_director"
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

  const supabase = getSupabaseServer()

  const { data: tmRow, error: tmError } = await supabase
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", session.user.id)
    .eq("active", true)
    .maybeSingle()

  if (tmError) {
    console.error("[getUserMembership] team_members lookup failed", { userId: session.user.id, teamId, error: tmError })
    throw new MembershipLookupError("Database error during membership lookup", tmError)
  }

  if (tmRow?.role) {
    return {
      userId: session.user.id,
      teamId,
      role: teamMemberDbRoleToNormalizedRole(String(tmRow.role)),
      permissions: undefined,
      positionGroups: undefined,
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("team_id, role")
    .eq("id", session.user.id)
    .maybeSingle()

  if (profileError) {
    console.error("[getUserMembership] profiles lookup failed", { userId: session.user.id, teamId, error: profileError })
    throw new MembershipLookupError("Database error during membership lookup", profileError)
  }

  if (profile?.team_id === teamId) {
    const role = profileRoleToNormalizedRole(profile.role)
    return {
      userId: session.user.id,
      teamId,
      role,
      permissions: undefined,
      positionGroups: undefined,
    }
  }

  const { data: team, error: teamError } = await supabase
    .from("teams")
    .select("created_by")
    .eq("id", teamId)
    .maybeSingle()

  if (teamError) {
    console.error("[getUserMembership] teams lookup failed", { userId: session.user.id, teamId, error: teamError })
    throw new MembershipLookupError("Database error during membership lookup", teamError)
  }

  const createdBy = (team as { created_by?: string } | null)?.created_by
  if (createdBy === session.user.id) {
    return {
      userId: session.user.id,
      teamId,
      role: ROLES.HEAD_COACH,
      permissions: undefined,
      positionGroups: undefined,
    }
  }

  // Program-level access: if team belongs to a program and user is a coach/AD in that program, grant membership
  const teamRow = team as { program_id?: string } | null
  const programId = teamRow?.program_id
  if (programId) {
    try {
      const programMembership = await getProgramMembership(programId)
      if (programMembership && ["head_coach", "assistant_coach", "athletic_director"].includes(programMembership.role)) {
        const role =
          programMembership.role === "head_coach"
            ? ROLES.HEAD_COACH
            : programMembership.role === "assistant_coach"
              ? ROLES.ASSISTANT_COACH
              : ROLES.ATHLETIC_DIRECTOR
        return {
          userId: session.user.id,
          teamId,
          role,
          permissions: undefined,
          positionGroups: undefined,
        }
      }
    } catch (err) {
      if (err instanceof MembershipLookupError) throw err
      console.warn("[getUserMembership] program membership check failed", { userId: session.user.id, teamId, programId, err })
    }
  }

  console.warn("[getUserMembership] no membership", {
    userId: session.user.id,
    teamId,
    profileTeamId: profile?.team_id ?? null,
    teamCreatedBy: createdBy ?? null,
    programId: programId ?? null,
  })
  return null
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
    membership = await getUserMembership(teamId)
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
  permission: "manage" | "edit_roster" | "manage_billing" | "post_announcements" | "view_payments" | "edit_offense_plays" | "edit_defense_plays" | "edit_special_teams_plays"
) {
  const { membership } = await requireTeamAccess(teamId)

  const checks = {
    manage: canManageTeam,
    edit_roster: canEditRoster,
    manage_billing: canManageBilling,
    post_announcements: canPostAnnouncements,
    view_payments: canViewPayments,
    edit_offense_plays: canEditRoster, // Coaches can edit offense plays
    edit_defense_plays: canEditRoster, // Coaches can edit defense plays
    edit_special_teams_plays: canEditRoster, // Coaches can edit special teams plays
  }

  if (!checks[permission](membership.role)) {
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

  const supabase = getSupabaseServer()
  const { data: member, error } = await supabase
    .from("program_members")
    .select("program_id, user_id, role")
    .eq("program_id", programId)
    .eq("user_id", session.user.id)
    .eq("active", true)
    .maybeSingle()

  if (error) {
    console.error("[getProgramMembership] program_members lookup failed", {
      userId: session.user.id,
      programId,
      error,
    })
    throw new MembershipLookupError("Database error during program membership lookup", error)
  }

  if (!member || !["head_coach", "assistant_coach", "athletic_director"].includes(String(member.role))) {
    return null
  }

  return {
    userId: session.user.id,
    programId: member.program_id,
    role: member.role as ProgramMembership["role"],
  }
}

/** Require the user to be a coach (head_coach or assistant_coach) in the program. */
export async function requireProgramCoach(programId: string): Promise<{ user: { id: string }; membership: ProgramMembership }> {
  const user = await requireAuth()
  let membership: ProgramMembership | null
  try {
    membership = await getProgramMembership(programId)
  } catch (err) {
    if (err instanceof MembershipLookupError) throw err
    throw err
  }

  const coachRoles: ProgramMembership["role"][] = ["head_coach", "assistant_coach"]
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

  if (!membership || membership.role !== "head_coach") {
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
