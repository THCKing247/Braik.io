"use client"

import type { PlayerFeedPost } from "@/components/portal/player-portal/feed/player-feed-types"
import { FeedPostCard } from "@/components/portal/player-portal/feed/feed-post-card"

export function PlayerFeedList({
  posts,
  accountBasePath,
}: {
  posts: PlayerFeedPost[]
  accountBasePath: string
  /** Kept for API compat — no longer used in render */
  hasCoachAnnouncementPosts?: boolean
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

  return (
    <ul className="space-y-[14px]">
      {sorted.map((post) => (
        <li key={post.id}>
          <FeedPostCard post={post} accountBasePath={accountBasePath} />
        </li>
      ))}
    </ul>
  )
}
