import { unstable_cache } from "next/cache"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export type EngagementHint = {
  id: string
  title: string
  description: string
  ctaLabel: string
  ctaHref: string
}

export type HintCounts = {
  playerCount: number
  playbookCount: number
  openInjuryCount: number
  announcementCount: number
}

/** Parallel head counts only — no row payloads. */
export async function loadEngagementHintCounts(teamId: string): Promise<HintCounts> {
  const supabase = getSupabaseServer()
  const [playerC, playbookC, injuryC, annC] = await Promise.all([
    supabase.from("players").select("id", { count: "exact", head: true }).eq("team_id", teamId),
    supabase.from("playbooks").select("id", { count: "exact", head: true }).eq("team_id", teamId),
    supabase
      .from("player_injuries")
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("status", "active"),
    supabase.from("team_announcements").select("id", { count: "exact", head: true }).eq("team_id", teamId),
  ])

  return {
    playerCount: playerC.count ?? 0,
    playbookCount: playbookC.count ?? 0,
    openInjuryCount: injuryC.count ?? 0,
    announcementCount: annC.count ?? 0,
  }
}

export function buildEngagementHints(teamId: string, c: HintCounts): EngagementHint[] {
  const hints: EngagementHint[] = []
  const enc = encodeURIComponent(teamId)

  if (c.playerCount === 0) {
    hints.push({
      id: "first_roster",
      title: "Add your first players",
      description: "A roster unlocks depth charts, messaging, and health tracking for this team.",
      ctaLabel: "Open roster",
      ctaHref: `/dashboard/roster?teamId=${enc}`,
    })
  }

  if (c.playbookCount === 0) {
    hints.push({
      id: "first_playbook",
      title: "Create a playbook",
      description: "Capture your installs and call sheets in one place.",
      ctaLabel: "Playbooks",
      ctaHref: `/dashboard/playbooks?teamId=${enc}`,
    })
  }

  if (c.openInjuryCount > 0) {
    hints.push({
      id: "open_injuries",
      title: "You have active injuries",
      description: "Resolve or update return expectations so staff stays aligned.",
      ctaLabel: "Health",
      ctaHref: `/dashboard/health?teamId=${enc}`,
    })
  }

  if (c.announcementCount === 0 && c.playerCount > 0) {
    hints.push({
      id: "first_announcement",
      title: "Post a team announcement",
      description: "Share schedules or reminders—parents and players see updates here.",
      ctaLabel: "Messaging & announcements",
      ctaHref: `/dashboard/messages?teamId=${enc}`,
    })
  }

  return hints
}

/**
 * Team-scoped counts; safe to share across coaches on the same team (hints are derived from public team state).
 */
export function getCachedEngagementHintCounts(teamId: string): Promise<HintCounts> {
  return unstable_cache(
    async () => loadEngagementHintCounts(teamId),
    ["engagement-hint-counts-v1", teamId],
    { revalidate: 22 }
  )()
}
