import type { PlayerFeedPost } from "@/components/portal/player-portal/feed/player-feed-types"
import {
  playerFilmHubPlaybooksFromPortalBase,
  playerFilmHubStudyFromPortalBase,
} from "@/lib/player-portal/player-development-routes"

/** Sample feed — replace with API-driven posts when backend is ready */
export function getMockPlayerFeed(accountBasePath: string): PlayerFeedPost[] {
  const p = (tail: string) =>
    tail.startsWith("/") ? `${accountBasePath}${tail}` : `${accountBasePath}/${tail}`

  return [
    {
      id: "mock-team-update",
      kind: "team_update",
      pinned: true,
      authorLabel: "Coach Rivera",
      authorSubtitle: "Head Coach",
      coachBadgeLabel: "Head Coach",
      timeLabel: "Pinned",
      title: "Road trip update: bus leaves at 4:15 PM sharp",
      body: "Bring both jerseys and cleats. Hydration packs are loaded. Keep Friday walkthrough notes ready.",
      visibilityLabel: "Team",
      mediaPlaceholder: "locker",
      cta: { label: "Details", href: p("/reminders") },
    },
    {
      id: "mock-result",
      kind: "game_result",
      authorLabel: "Braik Football",
      authorSubtitle: "Team Result",
      timeLabel: "2h ago",
      title: "Final: Braik 28, Central Eagles 17",
      highlightMeta: "Semifinal · Home",
      body: "Huge team win. Film review and corrections are posted in Team.",
      mediaPlaceholder: "stadium",
      cta: { label: "View", href: p("/calendar") },
    },
    {
      id: "mock-coach-video",
      kind: "coach_video",
      authorLabel: "Coach Kim",
      authorSubtitle: "Position Coach",
      coachBadgeLabel: "Position Coach",
      timeLabel: "Yesterday",
      title: "Third-down coverage film cut-up posted",
      body: "DB and WR groups should review before tomorrow's install.",
      visibilityLabel: "Position Group",
      mediaPlaceholder: "film",
      cta: { label: "View", href: playerFilmHubStudyFromPortalBase(accountBasePath) },
    },
    {
      id: "mock-playbook-update",
      kind: "team_update",
      authorLabel: "Offensive Coordinator",
      authorSubtitle: "Coach Post",
      coachBadgeLabel: "Offensive Coordinator",
      timeLabel: "2d ago",
      title: "Playbook install updated for red zone package",
      body: "Review pages 12-14 and bring two questions to the next meeting.",
      mediaPlaceholder: "practice",
      cta: { label: "Details", href: playerFilmHubPlaybooksFromPortalBase(accountBasePath) },
    },
    {
      id: "mock-team-pulse",
      kind: "team_update",
      authorLabel: "Braik Team",
      authorSubtitle: "Team Update",
      timeLabel: "3d ago",
      title: "Travel list and hydration reminders posted",
      body: "Check Team for travel packet updates and complete readiness checklist tonight.",
      cta: { label: "Details", href: p("/profile") },
    },
  ]
}
