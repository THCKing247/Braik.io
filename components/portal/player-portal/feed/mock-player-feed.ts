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
      id: "mock-result",
      kind: "game_result",
      authorLabel: "Braik Football",
      authorRole: "team",
      authorSubtitle: "Team · 2h ago",
      timeLabel: "2h ago",
      body: "HUGE team win. Film review and corrections are up in Team — great night, protect the ball, finish the job. 🏆",
      reactions: [
        { emoji: "🔥", count: 68 },
        { emoji: "💪", count: 34 },
        { emoji: "❤️", count: 21 },
      ],
      commentCount: 23,
      reactionSummary: "Jalen and 67 others reacted",
      cta: { label: "View", href: p("/calendar") },
    },
    {
      id: "mock-team-update",
      kind: "coach_announcement",
      pinned: true,
      authorLabel: "Coach Rivera",
      authorRole: "coach",
      authorSubtitle: "Head Coach · Today 2:10 PM",
      timeLabel: "Pinned",
      body: "Bus leaves 4:15 PM sharp. 🚌 Bring both jerseys and cleats — hydration packs are loaded. Have your Friday walkthrough notes ready.",
      mediaPlaceholder: "locker",
      reactions: [
        { emoji: "👍", count: 41 },
        { emoji: "🔥", count: 12 },
      ],
      commentCount: 8,
      cta: { label: "Details", href: p("/reminders") },
    },
    {
      id: "mock-coach-video",
      kind: "coach_video",
      authorLabel: "Coach Kim",
      authorRole: "coach",
      authorSubtitle: "DBs · Yesterday",
      timeLabel: "Yesterday",
      body: "Third-down coverage cut-up is live. DB + WR groups — watch it before tomorrow's install. 👀",
      mediaPlaceholder: "film",
      reactions: [
        { emoji: "👀", count: 19 },
        { emoji: "🔥", count: 7 },
      ],
      commentCount: 4,
      cta: { label: "View", href: playerFilmHubStudyFromPortalBase(accountBasePath) },
    },
    {
      id: "mock-playbook-update",
      kind: "team_update",
      authorLabel: "Coach Dunn",
      authorRole: "coach",
      authorSubtitle: "Offensive Coordinator · 2d ago",
      timeLabel: "2d ago",
      body: "Red zone package updated — pages 12–14. Bring two questions to the next meeting. 📓",
      mediaPlaceholder: "practice",
      reactions: [
        { emoji: "👍", count: 15 },
      ],
      commentCount: 6,
      cta: { label: "Details", href: playerFilmHubPlaybooksFromPortalBase(accountBasePath) },
    },
  ]
}
