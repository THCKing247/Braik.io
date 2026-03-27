import { revalidateTag, unstable_cache } from "next/cache"
import { loadAdCoachesBootstrapUncached, type AdBootstrapPayload } from "@/lib/ad/ad-bootstrap"

const ROLE_CACHE_NONE = "__no_role__"

/** Invalidate after coach-invites / coach-assignments mutations so bootstrap refetch is fresh. */
export const AD_COACHES_BOOTSTRAP_CACHE_TAG = "ad-coaches-bootstrap"

export function revalidateAdCoachesBootstrapCache(): void {
  revalidateTag(AD_COACHES_BOOTSTRAP_CACHE_TAG)
}

/**
 * AD Coaches page: teams picklist + coach assignment rows + hints. Keyed by user, role, and hints team selector.
 */
export function getCachedAdCoachesBootstrap(
  userId: string,
  viewerRoleUpper: string,
  hintsTeamQuery: string | null
): Promise<AdBootstrapPayload> {
  const roleKey = viewerRoleUpper?.toUpperCase().replace(/ /g, "_") || ROLE_CACHE_NONE
  const hintKey = hintsTeamQuery?.trim() || "__auto__"
  return unstable_cache(
    async () => loadAdCoachesBootstrapUncached(userId, viewerRoleUpper, hintsTeamQuery?.trim() || null),
    ["ad-coaches-bootstrap-v1", userId, roleKey, hintKey],
    { revalidate: 15, tags: [AD_COACHES_BOOTSTRAP_CACHE_TAG] }
  )()
}
