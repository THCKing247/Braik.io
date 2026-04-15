import {
  lightweightCached,
  LW_TTL_ENGAGEMENT_HINTS,
  tagTeamEngagementHints,
} from "@/lib/cache/lightweight-get-cache"
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

/** Single RPC for head counts — no row payloads. */
export async function loadEngagementHintCounts(teamId: string): Promise<HintCounts> {
  const supabase = getSupabaseServer()
  const { data, error } = await supabase.rpc("get_engagement_hint_counts_fast", {
    team_id_param: teamId,
  })

  if (error) throw error

  const counts: HintCounts = {
    playerCount: data?.playerCount ?? 0,
    playbookCount: data?.playbookCount ?? 0,
    openInjuryCount: data?.openInjuryCount ?? 0,
    announcementCount: data?.announcementCount ?? 0,
  }

  return counts
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
  return lightweightCached(
    ["engagement-hint-counts-v1", teamId],
    {
      revalidate: LW_TTL_ENGAGEMENT_HINTS,
      /** Team-scoped aggregate counts; safe across members (no PII in cache value). */
      tags: [tagTeamEngagementHints(teamId)],
    },
    () => loadEngagementHintCounts(teamId)
  )
}
