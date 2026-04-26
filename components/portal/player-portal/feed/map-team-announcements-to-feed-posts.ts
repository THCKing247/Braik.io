import type { PlayerFeedPost } from "@/components/portal/player-portal/feed/player-feed-types"
import { feedRelativeTime } from "@/lib/portal/feed-relative-time"
import type { TeamAnnouncementRow } from "@/lib/team-announcements"

/** Maps coach `team_announcements` rows into feed cards for the player home stream. */
export function mapTeamAnnouncementsToFeedPosts(
  rows: TeamAnnouncementRow[],
  accountBasePath: string
): PlayerFeedPost[] {
  const announcementsHref = accountBasePath.endsWith("/")
    ? `${accountBasePath}announcements`
    : `${accountBasePath}/announcements`

  return rows.map((row) => ({
    id: `announcement-${row.id}`,
    kind: "announcement",
    authorLabel: row.author_name?.trim() || "Coach",
    authorSubtitle: "Announcement",
    timeLabel: feedRelativeTime(row.created_at),
    title: row.title,
    body: row.body,
    pinned: row.is_pinned,
    createdAtForSort: row.created_at,
    cta: { label: "All announcements", href: announcementsHref },
  }))
}
