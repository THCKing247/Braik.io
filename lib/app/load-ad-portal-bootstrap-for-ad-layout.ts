import type { AppAdPortalBootstrapPayload } from "@/lib/app/app-ad-portal-bootstrap-types"
import { getCachedAppAdPortalBootstrap } from "@/lib/app/app-bootstrap-cache"
import { buildAppAdPortalBootstrapPayload } from "@/lib/app/build-app-ad-portal-bootstrap"
import { shouldLogRoutePerf } from "@/lib/debug/route-perf"
import { getRequestAuth } from "@/lib/auth/request-auth-context"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export type LoadAdPortalBootstrapForAdLayoutResult =
  | { ok: true; payload: AppAdPortalBootstrapPayload }
  | { ok: false; kind: "unauthorized" | "forbidden" }

/**
 * Server-only AD shell payload for `app/(portal)/dashboard/(ad)/ad/layout.tsx`.
 * Uses the same cache key and builder as GET `/api/app/bootstrap?portal=ad&includeTeamsTable=0` so the
 * client does not need a duplicate round trip to paint the nav + `AdAppBootstrapProvider` context.
 */
export async function loadAdPortalBootstrapForAdLayout(): Promise<LoadAdPortalBootstrapForAdLayoutResult> {
  const sessionResult = await getRequestAuth()
  if (!sessionResult?.user?.id) {
    return { ok: false, kind: "unauthorized" }
  }
  const u = sessionResult.user
  const useCache = !shouldLogRoutePerf()
  try {
    const payload = useCache
      ? await getCachedAppAdPortalBootstrap(
          u.id,
          u.email,
          u.role ?? "",
          u.isPlatformOwner === true,
          false
        )
      : await buildAppAdPortalBootstrapPayload(getSupabaseServer(), {
          userId: u.id,
          email: u.email,
          liteRole: u.role ?? "",
          isPlatformOwner: u.isPlatformOwner === true,
          includeTeamsTable: false,
        })
    return { ok: true, payload }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === "AD_BOOTSTRAP_FORBIDDEN") {
      return { ok: false, kind: "forbidden" }
    }
    throw err
  }
}
