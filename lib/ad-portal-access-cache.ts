import { unstable_cache } from "next/cache"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getAdPortalAccessForUser, type AdPortalAccess } from "@/lib/ad-portal-access"

const ROLE_CACHE_KEY_NONE = "__no_role__"

/**
 * Short-lived cache for AD portal resolution (same inputs as API). Keyed by user + role string.
 * Skip when profiling so timings reflect live queries (`BRAIK_PERF_DEBUG` / dev handled by caller).
 */
export function getCachedAdPortalAccessForUser(
  userId: string,
  sessionRoleUpper: string | null | undefined
): Promise<AdPortalAccess> {
  const roleKey = sessionRoleUpper?.toUpperCase() || ROLE_CACHE_KEY_NONE
  return unstable_cache(
    async () => {
      const supabase = getSupabaseServer()
      return getAdPortalAccessForUser(supabase, userId, sessionRoleUpper)
    },
    ["ad-portal-access-v1", userId, roleKey],
    { revalidate: 20 }
  )()
}
