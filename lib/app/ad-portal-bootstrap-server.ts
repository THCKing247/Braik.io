import { cache } from "react"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { buildAppAdPortalBootstrapPayload } from "@/lib/app/build-app-ad-portal-bootstrap"
import type { AppAdPortalBootstrapPayload } from "@/lib/app/app-ad-portal-bootstrap-types"

/**
 * One AD shell payload per React server request (layout + nested RSC pages share the same promise).
 * Primitive arguments so React `cache` dedupes across call sites.
 */
export const getCachedAdPortalBootstrapRequest = cache(
  async (
    userId: string,
    email: string,
    role: string,
    isPlatformOwner: boolean
  ): Promise<AppAdPortalBootstrapPayload> => {
    const supabase = getSupabaseServer()
    return buildAppAdPortalBootstrapPayload(supabase, {
      userId,
      email,
      liteRole: role,
      isPlatformOwner,
    })
  }
)
