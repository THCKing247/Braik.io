"use client"

import type { PlayerFeedPost } from "@/components/portal/player-portal/feed/player-feed-types"
import { FeedPostCard } from "@/components/portal/player-portal/feed/feed-post-card"

export function PlayerFeedList({
  posts,
  accountBasePath,
  hasCoachAnnouncementPosts = false,
  hasPlayerHighlightPosts = false,
}: {
  posts: PlayerFeedPost[]
  accountBasePath: string
  /** True when at least one post comes from live `team_announcements` — adjusts the list subtitle badge. */
  hasCoachAnnouncementPosts?: boolean
  /** True when at least one post comes from `team_highlight_posts`. */
  hasPlayerHighlightPosts?: boolean
}) {
  const sortMs = (p: PlayerFeedPost) =>
    p.createdAtForSort && !Number.isNaN(Date.parse(p.createdAtForSort))
      ? Date.parse(p.createdAtForSort)
      : 0

  const sorted = [...posts].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return sortMs(b) - sortMs(a)
  })

  const liveBadge =
    hasCoachAnnouncementPosts || hasPlayerHighlightPosts ? "Live feed" : "Sample posts"

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3 px-0.5">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-300/75">Team feed</h3>
          <p className="mt-0.5 bg-gradient-to-r from-white via-amber-100 to-orange-100 bg-clip-text text-lg font-black text-transparent">
            What&apos;s happening
          </p>
        </div>
        <span className="rounded-full bg-gradient-to-r from-sky-600/40 to-orange-600/35 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white ring-1 ring-white/25">
          {liveBadge}
        </span>
      </div>

      <ul className="space-y-5">
        {sorted.map((post) => (
          <li key={post.id}>
            <FeedPostCard post={post} accountBasePath={accountBasePath} />
          </li>
        ))}
      </ul>
    </div>
  )
}
