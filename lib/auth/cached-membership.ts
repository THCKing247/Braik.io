import { unstable_cache } from "next/cache"
import { getUserMembershipForUserId, type UserMembership } from "@/lib/auth/rbac"

/**
 * Short-lived cache for `getUserMembershipForUserId` (hot dashboard / bootstrap path).
 * Key includes userId + teamId — entries are never shared across users or teams.
 * Stale for ~22s if membership changes (removed user, role flip); uncached API remains source of truth elsewhere.
 */
export function getUserMembershipForUserIdCached(teamId: string, userId: string): Promise<UserMembership | null> {
  if (!userId) return Promise.resolve(null)
  return unstable_cache(
    async () => getUserMembershipForUserId(teamId, userId),
    ["user-team-membership-v1", teamId, userId],
    { revalidate: 22 }
  )()
}
