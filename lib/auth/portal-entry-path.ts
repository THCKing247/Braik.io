import type { SupabaseClient } from "@supabase/supabase-js"
import { canAccessAdPortalRoutes, resolveFootballAdAccessState } from "@/lib/enforcement/football-ad-access"

const ADMIN_DASHBOARD = "/admin/dashboard"
const AD_PORTAL = "/dashboard/ad"
const HC_DASHBOARD = "/dashboard"

/**
 * First portal route after sign-in / mobile resume when no stored path (Phase 2).
 * Uses README ownership + Phase 1 access states — separate from shell layout.
 */
export async function resolvePortalEntryPath(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle()

  const raw = (profile?.role ?? "player").toLowerCase().replace(/-/g, "_").replace(/ /g, "_")
  if (raw === "admin") return ADMIN_DASHBOARD

  const access = await resolveFootballAdAccessState(supabase, userId)
  if (canAccessAdPortalRoutes(access)) {
    return access.state === "restricted_football_ad" ? `${AD_PORTAL}/teams` : AD_PORTAL
  }
  return HC_DASHBOARD
}

export const PORTAL_ENTRY_PATHS = {
  ADMIN_DASHBOARD,
  AD_PORTAL,
  HC_DASHBOARD,
} as const
