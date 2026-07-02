import type { PlayerFeedPost } from "@/components/portal/player-portal/feed/player-feed-types"
import { feedRelativeTime } from "@/lib/portal/feed-relative-time"
import type { TeamHighlightPostRow } from "@/lib/team-highlight-posts/types"

/** Maps player-authored `team_highlight_posts` into feed cards. */
export function mapTeamHighlightPostsToFeedPosts(rows: TeamHighlightPostRow[]): PlayerFeedPost[] {
  return rows.map((row) => ({
    id: `highlight-${row.id}`,
    kind: "highlight" as const,
    authorLabel: row.author_name?.trim() || "Teammate",
    authorRole: "player" as const,
    authorSubtitle: `Player · ${feedRelativeTime(row.created_at)}`,
    timeLabel: feedRelativeTime(row.created_at),
    title: row.title,
    body: row.body || undefined,
    createdAtForSort: row.created_at,
    mediaPlaceholder: "field" as const,
    reactions: [
      { emoji: "🔥", count: 0 },
      { emoji: "💪", count: 0 },
    ],
    commentCount: 0,
  }))
}
