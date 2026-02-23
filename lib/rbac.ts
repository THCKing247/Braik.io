import { getServerSession } from "next-auth"
import { authOptions } from "./auth"
import { prisma } from "./prisma"
import { ROLES, type Role, canManageTeam, canEditRoster, canManageBilling, canPostAnnouncements, canViewPayments } from "./roles"
import { logPermissionDenial } from "./structured-logger"

export interface UserMembership {
  userId: string
  teamId: string
  role: Role
  permissions?: any
}

export async function getUserMembership(teamId: string): Promise<UserMembership | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return null
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_teamId: {
        userId: session.user.id,
        teamId,
      },
    },
  })

  if (!membership) {
    return null
  }

  return {
    userId: membership.userId,
    teamId: membership.teamId,
    role: membership.role as Role,
    permissions: membership.permissions,
  }
}

export async function requireAuth() {
  const session = await getServerSession(authOptions)
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

