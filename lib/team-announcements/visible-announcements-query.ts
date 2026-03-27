import {
  lightweightCached,
  LW_TTL_TEAM_ANNOUNCEMENTS,
  tagTeamAnnouncements,
} from "@/lib/cache/lightweight-get-cache"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import type { Role } from "@/lib/auth/roles"
import { sortTeamAnnouncements, userCanViewTeamAnnouncement } from "@/lib/team-announcements"

/**
 * Dashboard card fields only (omit send_notification etc.).
 */
export async function loadVisibleTeamAnnouncementsSorted(teamId: string, viewerRole: Role) {
  const supabase = getSupabaseServer()
  const { data: rows, error } = await supabase
    .from("team_announcements")
    .select("id, team_id, title, body, author_id, author_name, created_at, updated_at, is_pinned, audience")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message || "team_announcements query failed")
  }

  const list = (rows ?? []).filter((r) =>
    userCanViewTeamAnnouncement(viewerRole, String((r as { audience?: string }).audience || "all"))
  )
  return sortTeamAnnouncements(list as Parameters<typeof sortTeamAnnouncements>[0])
}

/** Visibility depends on viewer role — key includes role. */
export function getCachedVisibleTeamAnnouncements(teamId: string, viewerRole: Role) {
  return lightweightCached(
    ["team-announcements-visible-v1", teamId, viewerRole],
    {
      revalidate: LW_TTL_TEAM_ANNOUNCEMENTS,
      /** teamId + role: parents vs players see different announcement subsets from the same team rows. */
      tags: [tagTeamAnnouncements(teamId)],
    },
    () => loadVisibleTeamAnnouncementsSorted(teamId, viewerRole)
  )
}
