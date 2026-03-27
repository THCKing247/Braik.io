import { loadAdCoachesBootstrapUncached, type AdBootstrapPayload } from "@/lib/ad/ad-bootstrap"
import {
  lightweightCached,
  LW_TTL_AD_COACHES_BOOTSTRAP,
  revalidateAdCoachesBootstrap,
  TAG_AD_COACHES_BOOTSTRAP,
} from "@/lib/cache/lightweight-get-cache"

const ROLE_CACHE_NONE = "__no_role__"

/** Invalidate after coach-invites / coach-assignments mutations so bootstrap refetch is fresh. */
export const AD_COACHES_BOOTSTRAP_CACHE_TAG = TAG_AD_COACHES_BOOTSTRAP

export function revalidateAdCoachesBootstrapCache(): void {
  revalidateAdCoachesBootstrap()
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
  return lightweightCached(
    ["ad-coaches-bootstrap-v1", userId, roleKey, hintKey],
    {
      revalidate: LW_TTL_AD_COACHES_BOOTSTRAP,
      tags: [AD_COACHES_BOOTSTRAP_CACHE_TAG],
    },
    () => loadAdCoachesBootstrapUncached(userId, viewerRoleUpper, hintsTeamQuery?.trim() || null)
  )
}
