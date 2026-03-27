/**
 * Shared policy for short-lived `unstable_cache` on lightweight GET data.
 *
 * - Keys must include every dimension that changes the payload (userId, teamId, role bucket, etc.).
 * - Tags must be narrow enough to revalidate on the matching mutation without flushing unrelated teams.
 * - `revalidate` is in seconds (Next.js Data Cache). This is not true CDN edge without a platform
 *   that respects Next fetch/cache; it still skips repeated origin DB work under load.
 */

import { revalidateTag, unstable_cache } from "next/cache"

// ─── TTLs (seconds) — keep aligned with product expectations in route comments ───────────────

/** App + AD portal shell: nav flags, unread count, team header — stale ≤~1 poll cycle */
export const LW_TTL_APP_BOOTSTRAP = 8

/** Home dashboard first paint: games + calendar rows + readiness summary */
export const LW_TTL_DASHBOARD_BOOTSTRAP = 8

/** Engagement hint *counts* (heads only) — roster/playbook/injury/announcement tallies */
export const LW_TTL_ENGAGEMENT_HINTS = 22

/** Notification list preview + unread total for polling clients */
export const LW_TTL_NOTIFICATIONS_PREVIEW = 8

/** Team announcements list for dashboard card (role-scoped cache key) */
export const LW_TTL_TEAM_ANNOUNCEMENTS = 8

/** Readiness RPC summary (coach) — same payload embedded in dashboard bootstrap */
export const LW_TTL_READINESS_SUMMARY = 24

/** AD coaches tab bootstrap (teams picklist + coach rows) */
export const LW_TTL_AD_COACHES_BOOTSTRAP = 15

/** AD portal shell payload (org, teams summary, flags) */
export const LW_TTL_AD_PORTAL_SHELL = 15

/** Full calendar list GET for team (same rows for all members; RBAC at route) */
export const LW_TTL_TEAM_CALENDAR = 8

/** Stats weekly games list GET */
export const LW_TTL_STATS_GAMES = 8

/** Inventory list + player map — changes less often but payload is larger */
export const LW_TTL_TEAM_INVENTORY = 10

// ─── Tags — use `revalidateTag` with the narrowest tag that covers invalidated rows ───────────

/** Legacy umbrella: app bootstrap + AD shell + (optional) paired invalidations */
export const TAG_LIGHTWEIGHT_APP_SHELL = "app-bootstrap-v1"

export function tagTeamDashboardBootstrap(teamId: string): string {
  return `lw-dash-bootstrap:${teamId}`
}

export function tagTeamEngagementHints(teamId: string): string {
  return `lw-engagement-hints:${teamId}`
}

export function tagTeamAnnouncements(teamId: string): string {
  return `lw-team-announcements:${teamId}`
}

/** All notification preview variants for this user+team share this tag */
export function tagNotificationsUserTeam(userId: string, teamId: string): string {
  return `lw-notifications:${userId}:${teamId}`
}

export function tagTeamReadinessSummary(teamId: string): string {
  return `lw-readiness-summary:${teamId}`
}

export function tagTeamCalendar(teamId: string): string {
  return `lw-team-calendar:${teamId}`
}

export function tagTeamStatsGames(teamId: string): string {
  return `lw-stats-games:${teamId}`
}

export function tagTeamInventory(teamId: string): string {
  return `lw-team-inventory:${teamId}`
}

export const TAG_AD_COACHES_BOOTSTRAP = "lw-ad-coaches-bootstrap"

export function tagAdCoachesBootstrap(): string {
  return TAG_AD_COACHES_BOOTSTRAP
}

/** Games list + embedded games on dashboard bootstrap share invalidation after schedule/score edits. */
export function revalidateTeamGamesAndDashboard(teamId: string): void {
  revalidateTeamStatsGames(teamId)
  revalidateTeamDashboardBootstrap(teamId)
}

// ─── Revalidation helpers (mutations call these; avoid broad tags) ─────────────────────────────

export function revalidateLightweightAppShell(): void {
  revalidateTag(TAG_LIGHTWEIGHT_APP_SHELL)
}

export function revalidateTeamDashboardBootstrap(teamId: string): void {
  revalidateTag(tagTeamDashboardBootstrap(teamId))
}

export function revalidateTeamEngagementHints(teamId: string): void {
  revalidateTag(tagTeamEngagementHints(teamId))
}

export function revalidateTeamAnnouncements(teamId: string): void {
  revalidateTag(tagTeamAnnouncements(teamId))
}

export function revalidateNotificationsForUserTeam(userId: string, teamId: string): void {
  revalidateTag(tagNotificationsUserTeam(userId, teamId))
}

export function revalidateTeamReadinessSummary(teamId: string): void {
  revalidateTag(tagTeamReadinessSummary(teamId))
}

export function revalidateTeamCalendar(teamId: string): void {
  revalidateTag(tagTeamCalendar(teamId))
}

export function revalidateTeamStatsGames(teamId: string): void {
  revalidateTag(tagTeamStatsGames(teamId))
}

export function revalidateTeamInventory(teamId: string): void {
  revalidateTag(tagTeamInventory(teamId))
}

export function revalidateAdCoachesBootstrap(): void {
  revalidateTag(tagAdCoachesBootstrap())
}

/** Roster / readiness / players: dashboard + hints + readiness summary share team-scoped signals */
export function revalidateTeamRosterDerivedCaches(teamId: string): void {
  revalidateTeamDashboardBootstrap(teamId)
  revalidateTeamEngagementHints(teamId)
  revalidateTeamReadinessSummary(teamId)
}

/**
 * Standard wrapper: single place for tags + TTL on lightweight GET caches.
 * `cacheKey` must be unique per distinct payload (include user/team/role buckets as needed).
 */
export function lightweightCached<T>(
  cacheKey: string[],
  opts: { revalidate: number; tags: string[] },
  fn: () => Promise<T>
): Promise<T> {
  return unstable_cache(fn, cacheKey, {
    revalidate: opts.revalidate,
    tags: opts.tags,
  })()
}
