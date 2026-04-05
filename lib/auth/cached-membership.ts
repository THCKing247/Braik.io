import { revalidateTag, unstable_cache } from "next/cache"
import { getUserMembershipForUserId, type UserMembership } from "@/lib/auth/rbac"

/** Narrow tag for `revalidateTag` when `team_members` (or equivalent) changes for this pair. */
export function tagUserTeamMembership(teamId: string, userId: string): string {
  return `membership:${teamId}:${userId}`
}

export function revalidateUserTeamMembershipCache(teamId: string, userId: string): void {
  if (!teamId || !userId) return
  revalidateTag(tagUserTeamMembership(teamId, userId))
}

/**
 * Short-lived cache for `getUserMembershipForUserId` (hot dashboard / bootstrap path).
 * Key includes userId + teamId — entries are never shared across users or teams.
 * Stale for ~22s if membership changes; call `revalidateUserTeamMembershipCache` after writes when correctness matters immediately.
 */
export function getUserMembershipForUserIdCached(teamId: string, userId: string): Promise<UserMembership | null> {
  if (!userId) return Promise.resolve(null)
  return unstable_cache(
    async () => getUserMembershipForUserId(teamId, userId),
    ["user-team-membership-v1", teamId, userId],
    { revalidate: 22, tags: [tagUserTeamMembership(teamId, userId)] }
  )()
}
