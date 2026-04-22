"use client"

import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"
import { getMockPlayerFeed } from "@/components/portal/player-portal/feed/mock-player-feed"
import { PlayerFeedList } from "@/components/portal/player-portal/feed/player-feed-list"
import { PlayerTeamHero } from "@/components/portal/player-portal/feed/player-team-hero"
import { QuickToolsStrip } from "@/components/portal/player-portal/feed/quick-tools-strip"

/**
 * Feed-first player home — mobile-first. Desktop can later wrap this column in a wider grid
 * (`lg:grid lg:grid-cols-[minmax(0,1fr)_320px]` etc.) without changing route structure.
 */
export function PlayerPortalHome() {
  const { accountSegment, teamName, sport, userName, userEmail } = usePlayerPortal()
  const basePath = `/player/${encodeURIComponent(accountSegment)}`

  const firstName =
    userName?.split(/\s+/)[0]?.trim() ||
    (userEmail?.split("@")[0] ? userEmail.split("@")[0].replace(/\./g, " ") : null) ||
    "Athlete"

  const feed = getMockPlayerFeed(basePath)

  return (
    <div className="player-portal-feed-root mx-auto w-full max-w-lg pb-4 lg:max-w-2xl">
      <PlayerTeamHero firstName={firstName} teamName={teamName} sport={sport} basePath={basePath} />

      <div className="mt-6">
        <QuickToolsStrip basePath={basePath} />
      </div>

      <div className="mt-8">
        <PlayerFeedList posts={feed} accountBasePath={basePath} />
      </div>
    </div>
  )
}
