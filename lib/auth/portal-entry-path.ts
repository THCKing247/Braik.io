import type { SupabaseClient } from "@supabase/supabase-js"
import { canAccessAdPortalRoutes, resolveFootballAdAccessState } from "@/lib/enforcement/football-ad-access"
import { resolveBraikPortalKind } from "@/lib/portal/resolve-portal-kind"
import { defaultDashboardEntryForPortal } from "@/lib/portal/dashboard-path"
import {
  buildOrganizationPortalPath,
  resolveDefaultShortOrgIdForUser,
} from "@/lib/navigation/organization-routes"

const ADMIN_DASHBOARD = "/admin/overview"
const ORGANIZATION_PORTAL_FALLBACK = "/dashboard/ad"

function profileDbRoleToUpper(profileRoleFromDb: string | null | undefined): string {
  const raw = (profileRoleFromDb ?? "player").trim()
  return raw.toUpperCase().replace(/ /g, "_").replace(/-/g, "_")
}

/**
 * Same routing as {@link resolvePortalEntryPath} but skips a profiles row fetch when the caller
 * already loaded `profiles.role` (e.g. POST /api/auth/login — saves one round trip).
 */
export async function resolvePortalEntryPathWithProfileRole(
  supabase: SupabaseClient,
  userId: string,
  profileRoleFromDb: string | null | undefined
): Promise<string> {
  const raw = (profileRoleFromDb ?? "player").toLowerCase().replace(/-/g, "_").replace(/ /g, "_")
  if (raw === "admin") return ADMIN_DASHBOARD

  const access = await resolveFootballAdAccessState(supabase, userId)
  if (canAccessAdPortalRoutes(access)) {
    const shortOrgId = await resolveDefaultShortOrgIdForUser(supabase, userId)
    if (shortOrgId) {
      return buildOrganizationPortalPath(
        shortOrgId,
        access.state === "restricted_football_ad" ? "/teams" : ""
      )
    }
    return access.state === "restricted_football_ad"
      ? `${ORGANIZATION_PORTAL_FALLBACK}/teams`
      : ORGANIZATION_PORTAL_FALLBACK
  }

  const portalKind = await resolveBraikPortalKind({
    supabase,
    userId,
    profileRoleUpper: profileDbRoleToUpper(profileRoleFromDb),
  })
  return defaultDashboardEntryForPortal(portalKind)
}

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

  return resolvePortalEntryPathWithProfileRole(supabase, userId, profile?.role as string | undefined)
}

export const PORTAL_ENTRY_PATHS = {
  ADMIN_DASHBOARD,
  AD_PORTAL: ORGANIZATION_PORTAL_FALLBACK,
} as const
