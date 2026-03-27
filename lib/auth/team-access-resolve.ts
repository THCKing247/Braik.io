import { getUserMembershipForUserId, type UserMembership } from "@/lib/auth/rbac"
import {
  canEditRoster,
  canManageTeam,
  canPostAnnouncements,
  canViewPayments,
} from "@/lib/auth/roles"

/**
 * Result of resolving team membership once for a request (e.g. dashboard bootstrap).
 * Prefer this over calling `getServerSession` + `requireTeamAccess` repeatedly across
 * parallel sub-handlers — keeps a single `team_members` / `profiles` / `program_members` path.
 */
export type ResolvedTeamAccess = {
  membership: UserMembership
  canEditRoster: boolean
  canManageTeam: boolean
  /** Includes JV/freshman delegated manage (matches manage permission checks). */
  canManageTeamEffective: boolean
  canPostAnnouncements: boolean
  canViewPayments: boolean
}

/**
 * Resolve membership and common permission flags for `(teamId, userId)`.
 * Returns null if the user is not a member (caller should 403 + audit if needed).
 */
export async function resolveTeamAccess(teamId: string, userId: string): Promise<ResolvedTeamAccess | null> {
  const membership = await getUserMembershipForUserId(teamId, userId)
  if (!membership) return null
  const delegated = Boolean(membership.delegatedTeamManage)
  return {
    membership,
    canEditRoster: canEditRoster(membership.role),
    canManageTeam: canManageTeam(membership.role),
    canManageTeamEffective: canManageTeam(membership.role) || delegated,
    canPostAnnouncements: canPostAnnouncements(membership.role),
    canViewPayments: canViewPayments(membership.role),
  }
}
