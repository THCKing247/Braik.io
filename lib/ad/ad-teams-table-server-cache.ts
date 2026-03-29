import { revalidateTag } from "next/cache"

/** Must match unstable_cache tag in GET /api/ad/pages/teams-table */
export function adTeamsTableCacheTagForUser(userId: string): string {
  return `ad-teams-user-${userId}`
}

/** Invalidate cached AD teams-table rows for one user (e.g. AD who created a team or invite). */
export function revalidateAdTeamsTableCacheForUser(userId: string): void {
  if (!userId) return
  revalidateTag(adTeamsTableCacheTagForUser(userId))
}
