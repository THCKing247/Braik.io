import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
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

/** Map profile.role (e.g. head_coach) to normalized Role (e.g. HEAD_COACH). */
function profileRoleToNormalizedRole(profileRole: string | null | undefined): Role {
  const raw = (profileRole ?? "player").toString().trim().toLowerCase().replace(/-/g, "_")
  if (raw === "head_coach") return ROLES.HEAD_COACH
  if (raw === "assistant_coach") return ROLES.ASSISTANT_COACH
  if (raw === "parent") return ROLES.PARENT
  if (raw === "school_admin" || raw === "admin") return ROLES.SCHOOL_ADMIN
  return ROLES.PLAYER
}

/**
 * Get the current user's membership for a team using production schema only:
 * - profiles.team_id + profiles.role (source of truth)
 * - teams.created_by (team creator counts as HEAD_COACH)
 * Does NOT use team_members (not present in production).
 */
export async function getUserMembership(teamId: string): Promise<UserMembership | null> {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return null
  }

  const supabase = getSupabaseServer()

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

  console.warn("[getUserMembership] no membership", {
    userId: session.user.id,
    teamId,
    profileTeamId: profile?.team_id ?? null,
    teamCreatedBy: createdBy ?? null,
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
  permission: "manage" | "edit_roster" | "manage_billing" | "post_announcements" | "view_payments"
) {
  const { membership } = await requireTeamAccess(teamId)

  const checks = {
    manage: canManageTeam,
    edit_roster: canEditRoster,
    manage_billing: canManageBilling,
    post_announcements: canPostAnnouncements,
    view_payments: canViewPayments,
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
