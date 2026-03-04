import { getServerSession } from "@/lib/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { ROLES, type Role, canManageTeam, canEditRoster, canManageBilling, canPostAnnouncements, canViewPayments } from "./roles"
import { logPermissionDenial } from "./structured-logger"

export interface UserMembership {
  userId: string
  teamId: string
  role: Role
  permissions?: unknown
  positionGroups?: unknown
}

export async function getUserMembership(teamId: string): Promise<UserMembership | null> {
  const session = await getServerSession()
  if (!session?.user?.id) {
    return null
  }

  const supabase = getSupabaseServer()
  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id, user_id, role, permissions")
    .eq("user_id", session.user.id)
    .eq("team_id", teamId)
    .eq("active", true)
    .maybeSingle()

  if (!membership) {
    return null
  }

  return {
    userId: membership.user_id,
    teamId: membership.team_id,
    role: (membership.role ?? "PARENT") as Role,
    permissions: (membership as { permissions?: unknown }).permissions,
    positionGroups: (membership as { position_groups?: unknown }).position_groups,
  }
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
  const membership = await getUserMembership(teamId)

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
