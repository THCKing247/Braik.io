import type { UserMembership } from "@/lib/auth/rbac"
import { buildAppBootstrapPayload } from "@/lib/app/build-app-bootstrap"
import { buildAppAdPortalBootstrapPayload } from "@/lib/app/build-app-ad-portal-bootstrap"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  lightweightCached,
  LW_TTL_APP_BOOTSTRAP,
  LW_TTL_AD_PORTAL_SHELL,
  revalidateLightweightAppShell,
  TAG_LIGHTWEIGHT_APP_SHELL,
  tagAdPortalBootstrapUser,
} from "@/lib/cache/lightweight-get-cache"

export const APP_BOOTSTRAP_CACHE_TAG = TAG_LIGHTWEIGHT_APP_SHELL

export function revalidateAppBootstrapCache(): void {
  revalidateLightweightAppShell()
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
  return lightweightCached(
    ["app-bootstrap-v1", userId, teamId, mKey],
    { revalidate: LW_TTL_APP_BOOTSTRAP, tags: [APP_BOOTSTRAP_CACHE_TAG] },
    () =>
      buildAppBootstrapPayload({
        userId,
        email,
        teamId,
        liteTeamId,
        liteRole,
        isPlatformOwner,
        membership,
      })
  )
}

const ROLE_CACHE_NONE = "__no_role__"

/**
 * AD portal shell; same tag as team bootstrap so `revalidateAppBootstrapCache` clears both.
 */
export function getCachedAppAdPortalBootstrap(
  userId: string,
  email: string,
  liteRole: string,
  isPlatformOwner: boolean
): Promise<import("@/lib/app/app-ad-portal-bootstrap-types").AppAdPortalBootstrapPayload> {
  const roleKey = liteRole?.toUpperCase().replace(/ /g, "_") || ROLE_CACHE_NONE
  return lightweightCached(
    ["app-ad-portal-bootstrap-v1", userId, roleKey],
    {
      revalidate: LW_TTL_AD_PORTAL_SHELL,
      tags: [APP_BOOTSTRAP_CACHE_TAG, tagAdPortalBootstrapUser(userId)],
    },
    () =>
      buildAppAdPortalBootstrapPayload(getSupabaseServer(), {
        userId,
        email,
        liteRole,
        isPlatformOwner,
      })
  )
}
