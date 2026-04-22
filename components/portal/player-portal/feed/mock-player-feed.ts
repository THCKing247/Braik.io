import type { PlayerFeedPost } from "@/components/portal/player-portal/feed/player-feed-types"

/** Sample feed — replace with API-driven posts when backend is ready */
export function getMockPlayerFeed(accountBasePath: string): PlayerFeedPost[] {
  const p = (tail: string) =>
    tail.startsWith("/") ? `${accountBasePath}${tail}` : `${accountBasePath}/${tail}`

  return [
    {
      id: "mock-pinned",
      kind: "pinned_reminder",
      pinned: true,
      authorLabel: "Coach Rivera",
      authorSubtitle: "Head Coach",
      timeLabel: "Pinned",
      title: "Road trip Friday — bus leaves at 4:15 PM sharp",
      body: "Bring both jerseys and cleats. Hydration packs on the bus. Study the red-zone installs tonight.",
      mediaPlaceholder: "locker",
      cta: { label: "View reminders", href: p("/reminders") },
    },
    {
      id: "mock-game",
      kind: "game_day",
      authorLabel: "Team",
      timeLabel: "2h ago",
      title: "Game day · Eastern Semifinals",
      highlightMeta: "vs Central Eagles · Kickoff 7:00 PM · Home",
      body: "Pack the juice. Warm-ups on Field A at 5:45. Family section is Gate D.",
      mediaPlaceholder: "stadium",
      cta: { label: "Calendar", href: p("/calendar") },
    },
    {
      id: "mock-announce",
      kind: "announcement",
      authorLabel: "Coach Alvarez",
      authorSubtitle: "OC",
      timeLabel: "5h ago",
      title: "Install update: tempo & RPO tags",
      body: "Thursday’s practice script is live. Watch the clip notes before chalk talk.",
      mediaPlaceholder: "practice",
      cta: { label: "Film room", href: p("/film-room") },
    },
    {
      id: "mock-highlight",
      kind: "highlight",
      authorLabel: "Braik Highlights",
      timeLabel: "Yesterday",
      title: "Top runs from Tuesday team period",
      body: "Four clips · every rep with coach audio. Tap through to Film Room.",
      mediaPlaceholder: "field",
      reactionSummary: "Team 🔥",
      cta: { label: "Open clips", href: p("/film-room") },
    },
    {
      id: "mock-image",
      kind: "image",
      authorLabel: "Team Photographer",
      timeLabel: "Yesterday",
      title: "Captains’ practice — sunrise",
      body: "Culture shots from this morning. Tag your position group.",
      mediaPlaceholder: "crowd",
    },
    {
      id: "mock-playbook",
      kind: "playbook_teaser",
      authorLabel: "Coach Kim",
      authorSubtitle: "WR",
      timeLabel: "2d ago",
      title: "Red zone: stack release rules",
      body: "Pages 12–14 updated — new vs cover-1/cover-3 split rules.",
      mediaPlaceholder: "film",
      cta: { label: "Open playbooks", href: p("/playbooks") },
    },
    {
      id: "mock-study",
      kind: "study_teaser",
      authorLabel: "Academic support",
      timeLabel: "3d ago",
      title: "Quiz: defensive recognition",
      body: "10 questions · due before Friday walkthrough.",
      cta: { label: "Study guides", href: p("/study-guides") },
    },
    {
      id: "mock-motivation",
      kind: "motivation",
      authorLabel: "Team",
      timeLabel: "3d ago",
      title: "Standard is the standard",
      body: "We don’t wait for permission to play fast. Bring energy every period — especially when it’s loud.",
      mediaPlaceholder: "practice",
    },
  ]
}
