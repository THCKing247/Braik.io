import type { SupabaseClient } from "@supabase/supabase-js"
import type { BraikPortalKind } from "@/lib/portal/braik-portal-kind"
import { defaultDashboardEntryForPortal } from "@/lib/portal/dashboard-path"
import {
  getParentPortalSegmentForUser,
  getPlayerAccountSegmentForUser,
} from "@/lib/portal/resolve-free-portal-segments"

export type ResolvedPortalHome = {
  defaultPath: string
  playerAccountSegment: string | null
  parentPortalSegment: string | null
}

/**
 * One DB pass for shell: default redirect URL plus public route segments for `/player` / `/parent` layouts.
 */
export async function resolvePortalHomeForUser(
  supabase: SupabaseClient,
  userId: string,
  portalKind: BraikPortalKind
): Promise<ResolvedPortalHome> {
  const [playerAccountSegment, parentPortalSegment] = await Promise.all([
    portalKind === "player" ? getPlayerAccountSegmentForUser(supabase, userId) : Promise.resolve(null),
    portalKind === "parent" ? getParentPortalSegmentForUser(supabase, userId) : Promise.resolve(null),
  ])

  let defaultPath = defaultDashboardEntryForPortal(portalKind)
  if (portalKind === "player" && playerAccountSegment) {
    defaultPath = `/player/${encodeURIComponent(playerAccountSegment)}`
  } else if (portalKind === "parent" && parentPortalSegment) {
    defaultPath = `/parent/${encodeURIComponent(parentPortalSegment)}`
  }

  return {
    defaultPath,
    playerAccountSegment,
    parentPortalSegment,
  }
}

/**
 * Default post-auth URL for a user given portal kind — prefers `/player/:accountId` and `/parent/:linkSegment`
 * when roster linkage exists; otherwise legacy `/dashboard/{player|parent}` entry.
 */
export async function resolveDefaultAppPathForPortalUser(
  supabase: SupabaseClient,
  userId: string,
  portalKind: BraikPortalKind
): Promise<string> {
  const { defaultPath } = await resolvePortalHomeForUser(supabase, userId, portalKind)
  return defaultPath
}
