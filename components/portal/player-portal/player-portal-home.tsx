"use client"

import { useEffect, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  kickDeferredCoreMerge,
  useDashboardBootstrapQuery,
} from "@/lib/dashboard/dashboard-bootstrap-query"
import type { TeamHighlightPostRow } from "@/lib/team-highlight-posts/types"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"
import { getMockPlayerFeed } from "@/components/portal/player-portal/feed/mock-player-feed"
import { mapTeamAnnouncementsToFeedPosts } from "@/components/portal/player-portal/feed/map-team-announcements-to-feed-posts"
import { mapTeamHighlightPostsToFeedPosts } from "@/components/portal/player-portal/feed/map-team-highlight-posts-to-feed-posts"
import { PlayerFeedList } from "@/components/portal/player-portal/feed/player-feed-list"
import { PlayerTeamHero } from "@/components/portal/player-portal/feed/player-team-hero"
import { QuickToolsStrip } from "@/components/portal/player-portal/feed/quick-tools-strip"
import {
  HIGHLIGHT_POSTS_QUERY_KEY,
  PlayerHighlightComposer,
} from "@/components/portal/player-portal/player-highlight-composer"

/**
 * Primary home screen: team feed (announcements, player highlights, sample content) + quick tools.
 * Route: `/player/:accountId` — first bottom tab (Home).
 */
export function PlayerPortalHome() {
  const { accountSegment, teamName, sport, userName, userEmail, teamId } = usePlayerPortal()
  const basePath = `/player/${encodeURIComponent(accountSegment)}`
  const queryClient = useQueryClient()
  const dashQ = useDashboardBootstrapQuery(teamId)

  useEffect(() => {
    const t = teamId.trim()
    if (!t || !dashQ.data?.deferredPending) return
    kickDeferredCoreMerge(t, queryClient)
  }, [teamId, dashQ.data?.deferredPending, queryClient])

  const { data: highlightPayload } = useQuery({
    queryKey: [HIGHLIGHT_POSTS_QUERY_KEY, teamId],
    queryFn: async (): Promise<{ posts: TeamHighlightPostRow[] }> => {
      const res = await fetch(`/api/teams/${encodeURIComponent(teamId)}/highlight-posts`, {
        credentials: "include",
      })
      if (!res.ok) throw new Error("highlight-posts")
      return res.json() as Promise<{ posts: TeamHighlightPostRow[] }>
    },
    enabled: Boolean(teamId?.trim()),
  })

  const firstName =
    userName?.split(/\s+/)[0]?.trim() ||
    (userEmail?.split("@")[0] ? userEmail.split("@")[0].replace(/\./g, " ") : null) ||
    "Athlete"

  const announcementPosts = useMemo(() => {
    const rows = dashQ.data?.announcements
    if (!rows?.length) return []
    return mapTeamAnnouncementsToFeedPosts(rows, basePath)
  }, [dashQ.data?.announcements, basePath])

  const playerHighlightPosts = useMemo(
    () => mapTeamHighlightPostsToFeedPosts(highlightPayload?.posts ?? []),
    [highlightPayload?.posts]
  )

  const feedPosts = useMemo(() => {
    const mock = getMockPlayerFeed(basePath)
    return [...announcementPosts, ...playerHighlightPosts, ...mock]
  }, [announcementPosts, playerHighlightPosts, basePath])

  return (
    <div className="player-portal-feed-root mx-auto w-full max-w-lg pb-4 lg:max-w-2xl">
      <PlayerTeamHero firstName={firstName} teamName={teamName} sport={sport} basePath={basePath} />

      <div className="mt-6">
        <QuickToolsStrip basePath={basePath} />
      </div>

      <div className="mt-6">
        <PlayerHighlightComposer teamId={teamId} />
      </div>

      <div className="mt-8">
        <PlayerFeedList
          posts={feedPosts}
          accountBasePath={basePath}
          hasCoachAnnouncementPosts={announcementPosts.length > 0}
          hasPlayerHighlightPosts={playerHighlightPosts.length > 0}
        />
      </div>
    </div>
  )
}
