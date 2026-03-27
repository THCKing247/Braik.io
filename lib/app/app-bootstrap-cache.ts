import { revalidateTag, unstable_cache } from "next/cache"
import type { UserMembership } from "@/lib/auth/rbac"
import { buildAppBootstrapPayload } from "@/lib/app/build-app-bootstrap"

export const APP_BOOTSTRAP_CACHE_TAG = "app-bootstrap-v1"

export function revalidateAppBootstrapCache(): void {
  revalidateTag(APP_BOOTSTRAP_CACHE_TAG)
}

function membershipCacheKey(m: UserMembership): string {
  return `${m.role}:${m.delegatedTeamManage ? "1" : "0"}:${m.staffStatus ?? ""}`
}

/**
 * Team-scoped shell snapshot. Caller must verify membership before invoking.
 * Key includes userId, teamId, and membership signature so RBAC-derived flags stay consistent.
 */
export function getCachedAppBootstrap(
  userId: string,
  email: string,
  teamId: string,
  liteTeamId: string | undefined,
  liteRole: string,
  isPlatformOwner: boolean,
  membership: UserMembership
): Promise<import("@/lib/app/app-bootstrap-types").AppBootstrapPayload> {
  const mKey = membershipCacheKey(membership)
  return unstable_cache(
    async () =>
      buildAppBootstrapPayload({
        userId,
        email,
        teamId,
        liteTeamId,
        liteRole,
        isPlatformOwner,
        membership,
      }),
    ["app-bootstrap-v1", userId, teamId, mKey],
    { revalidate: 10, tags: [APP_BOOTSTRAP_CACHE_TAG] }
  )()
}
