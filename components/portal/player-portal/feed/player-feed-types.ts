/**
 * Player portal feed — UI-only types for a team social stream.
 * Backend can later map CMS / announcements / media into these shapes.
 */

export type PlayerFeedPostKind =
  | "coach_announcement"
  | "team_update"
  | "game_result"
  | "coach_video"
  | "highlight"

export type PlayerFeedCta = {
  label: string
  /** Relative path under `/player/:accountSegment` or absolute internal path */
  href: string
}

export type PlayerFeedReaction = {
  emoji: string
  count: number
  reactedByMe?: boolean
}

export type PlayerFeedPost = {
  id: string
  kind: PlayerFeedPostKind
  /** Display name — coach staff or "Team" */
  authorLabel: string
  /** "coach" = orange ring, "team" = sky ring, "player" = no ring */
  authorRole?: "coach" | "team" | "player"
  authorSubtitle?: string
  coachBadgeLabel?: string
  visibilityLabel?: string
  announcementBadge?: boolean
  /** Relative time or absolute string for mock */
  timeLabel: string
  title?: string
  body?: string
  /** Optional gradient key for placeholder media (no asset yet) */
  mediaPlaceholder?: "stadium" | "practice" | "film" | "locker" | "field" | "crowd"
  imageHint?: string
  cta?: PlayerFeedCta
  pinned?: boolean
  /** Extra line — e.g. opponent, kickoff */
  highlightMeta?: string
  /** Reaction pills with counts */
  reactions?: PlayerFeedReaction[]
  commentCount?: number
  /** Facepile line text */
  reactionSummary?: string
  /** ISO timestamp for ordering mixed feed items (newer first after pin rules) */
  createdAtForSort?: string
  /** UUID from team_announcements.id — enables reaction/comment/view API calls */
  announcementId?: string
}
