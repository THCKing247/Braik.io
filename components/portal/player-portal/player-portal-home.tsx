"use client"

import { useEffect, useMemo } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Camera } from "lucide-react"
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
import {
  HIGHLIGHT_POSTS_QUERY_KEY,
} from "@/components/portal/player-portal/player-highlight-composer"

// ── stories rail ──────────────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  "linear-gradient(140deg,#2C4E9E,#152B63)",
  "linear-gradient(140deg,#B24A17,#6E2508)",
  "linear-gradient(140deg,#1E6FD9,#0E3E8C)",
  "linear-gradient(140deg,#178C56,#0B4A2C)",
  "linear-gradient(140deg,#7A4AE0,#3A1E86)",
]

const STORIES = [
  { id: "you", label: "Your story", content: "BA", grad: AVATAR_GRADIENTS[0], viewed: false, isMe: true },
  { id: "gameday", label: "Gameday", content: "🏈", grad: AVATAR_GRADIENTS[1], viewed: false, live: true },
  { id: "coach-riv", label: "Coach Riv", content: "CR", grad: AVATAR_GRADIENTS[0], viewed: false },
  { id: "film-room", label: "Film Room", content: "🎬", grad: AVATAR_GRADIENTS[2], viewed: false },
  { id: "hype-reel", label: "Hype Reel", content: "🔥", grad: AVATAR_GRADIENTS[4], viewed: true },
]

function StoriesRail({ userInitials }: { userInitials: string }) {
  return (
    <div
      className="mb-[2px] flex gap-[14px] overflow-x-auto pb-[14px] pt-[4px]"
      style={{ scrollbarWidth: "none" }}
    >
      {STORIES.map((s) => {
        const ringStyle = s.viewed
          ? { background: "rgba(146,165,204,0.35)" }
          : { background: "conic-gradient(#FF7A33,#FF3D1F,#4D9BFF,#FF7A33)" }

        return (
          <button
            key={s.id}
            type="button"
            className="flex shrink-0 w-[66px] flex-col items-center border-none bg-transparent p-0 text-[#EEF3FF]"
          >
            <div
              className="relative h-[64px] w-[64px] rounded-full p-[3px]"
              style={ringStyle}
            >
              <div
                className="flex h-full w-full items-center justify-center rounded-full border-[3px] border-[#060D22] text-[15px] font-black text-white"
                style={{ background: s.grad }}
              >
                {s.id === "you" ? userInitials : s.content}
                {s.isMe && (
                  <span
                    className="absolute -bottom-[1px] -right-[1px] flex h-[20px] w-[20px] items-center justify-center rounded-full border-[2.5px] border-[#060D22] bg-[#FF7A33] text-[13px] font-black text-[#160A02]"
                  >
                    +
                  </span>
                )}
              </div>
              {s.live && (
                <span
                  className="absolute -bottom-[3px] left-1/2 -translate-x-1/2 rounded-[6px] border-2 border-[#060D22] bg-[#FF3D1F] px-[7px] py-[2px] font-black text-[8px] uppercase tracking-[0.08em] text-white"
                  style={{ animation: "pulse 1.6s infinite" }}
                >
                  LIVE
                </span>
              )}
            </div>
            <span className="mt-[5px] w-full truncate text-center text-[10px] font-semibold text-[#92A5CC]">
              {s.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── composer row ─────────────────────────────────────────────────────────────

function ComposerRow({ userInitials }: { userInitials: string }) {
  return (
    <div className="mb-[16px] mt-[2px] flex items-center gap-[10px]">
      <div
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border border-[rgba(125,155,255,0.14)] bg-gradient-to-br from-[#2C4E9E] to-[#152B63] text-[12px] font-black text-[#EEF3FF]"
      >
        {userInitials}
      </div>
      <div
        className="flex-1 rounded-full border border-[rgba(125,155,255,0.14)] bg-white/[0.04] px-[16px] py-[11px] text-[13px] text-[#92A5CC] cursor-text"
      >
        Post a highlight…
      </div>
      <button
        type="button"
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border-none text-[#160A02]"
        style={{
          background: "linear-gradient(140deg,#FF7A33,#FF3D1F)",
          boxShadow: "0 8px 20px -8px rgba(255,90,30,0.7)",
        }}
        aria-label="Open camera"
      >
        <Camera className="h-[19px] w-[19px]" />
      </button>
    </div>
  )
}

/**
 * Primary mobile screen: feed-first team social stream.
 * Route: `/player/:accountId` — first bottom tab (Feed).
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

  const _firstName =
    userName?.split(/\s+/)[0]?.trim() ||
    (userEmail?.split("@")[0] ? userEmail.split("@")[0].replace(/\./g, " ") : null) ||
    "Athlete"

  const initials = (userName ?? "")
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase() || "BA"

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
    <div className="mx-auto w-full max-w-lg pb-4 lg:max-w-2xl">
      <StoriesRail userInitials={initials} />
      <PlayerTeamHero firstName={_firstName} teamName={teamName} sport={sport} basePath={basePath} />
      <ComposerRow userInitials={initials} />
      <PlayerFeedList
        posts={feedPosts}
        accountBasePath={basePath}
        hasCoachAnnouncementPosts={announcementPosts.length > 0}
        hasPlayerHighlightPosts={playerHighlightPosts.length > 0}
      />
    </div>
  )
}
