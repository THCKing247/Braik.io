/**
 * Player portal feed — UI-only types for a team social stream.
 * Backend can later map CMS / announcements / media into these shapes.
 */

export type PlayerFeedPostKind =
  | "announcement"
  | "image"
  | "game_day"
  | "highlight"
  | "media_clip"
  | "schedule"
  | "pinned_reminder"
  | "playbook_teaser"
  | "study_teaser"
  | "motivation"

export type PlayerFeedCta = {
  label: string
  /** Relative path under `/player/:accountSegment` or absolute internal path */
  href: string
}

export type PlayerFeedPost = {
  id: string
  kind: PlayerFeedPostKind
  /** Display name — coach staff or "Team" */
  authorLabel: string
  authorSubtitle?: string
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
  /** Conceptual engagement — wire when API exists */
  reactionSummary?: string
  /** ISO timestamp for ordering mixed feed items (newer first after pin rules) */
  createdAtForSort?: string
}
