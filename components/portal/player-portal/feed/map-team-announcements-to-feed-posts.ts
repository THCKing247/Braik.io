import type { PlayerFeedPost } from "@/components/portal/player-portal/feed/player-feed-types"
import { feedRelativeTime } from "@/lib/portal/feed-relative-time"
import { AUDIENCE_LABELS } from "@/lib/team-announcements"
import type { TeamAnnouncementRow } from "@/lib/team-announcements"

function inferCoachBadge(row: TeamAnnouncementRow): string {
  const source = `${row.author_name ?? ""} ${row.title ?? ""} ${row.body ?? ""}`.toLowerCase()
  if (source.includes("head coach")) return "Head Coach"
  if (source.includes("offensive coordinator")) return "Offensive Coordinator"
  if (source.includes("defensive coordinator")) return "Defensive Coordinator"
  if (source.includes("position coach")) return "Position Coach"
  return "Coach"
}

/** Maps coach `team_announcements` rows into feed cards for the player home stream. */
export function mapTeamAnnouncementsToFeedPosts(
  rows: TeamAnnouncementRow[],
  accountBasePath: string
): PlayerFeedPost[] {
  const announcementsHref = accountBasePath.endsWith("/")
    ? `${accountBasePath}announcements`
    : `${accountBasePath}/announcements`

  return rows.map((row) => {
    const coachBadgeLabel = inferCoachBadge(row)
    return {
    id: `announcement-${row.id}`,
    kind: "coach_announcement",
    authorLabel: row.author_name?.trim() || "Coach",
    authorSubtitle: coachBadgeLabel,
    coachBadgeLabel,
    visibilityLabel:
      row.audience === "all" ||
      row.audience === "staff" ||
      row.audience === "players" ||
      row.audience === "parents"
        ? AUDIENCE_LABELS[row.audience]
        : undefined,
    announcementBadge: true,
    timeLabel: feedRelativeTime(row.created_at),
    title: row.title,
    body: row.body,
    pinned: row.is_pinned,
    createdAtForSort: row.created_at,
    cta: { label: "Details", href: announcementsHref },
    }
  })
}
