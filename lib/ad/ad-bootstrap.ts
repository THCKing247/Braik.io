import type { SupabaseClient } from "@supabase/supabase-js"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  buildEngagementHints,
  getCachedEngagementHintCounts,
  type EngagementHint,
} from "@/lib/engagement/dashboard-hints-data"
import { fetchAdPortalVisibleTeams } from "@/lib/ad-team-scope"
import {
  fetchAdCoachAssignmentsPageData,
  type AdAssistantCoachAssignmentRow,
  type AdCoachAssignmentsPageData,
  type AdHeadCoachAssignmentRow,
  type AdPortalPreloadedTeamBundle,
} from "@/lib/ad-portal-coach-assignments"

const COACH_HINT_ROLES = new Set(["HEAD_COACH", "ASSISTANT_COACH", "ATHLETIC_DIRECTOR"])

export type AdBootstrapTeam = { id: string; name: string; programId: string | null }

export type AdBootstrapPayload = {
  teams: AdBootstrapTeam[]
  coaches: {
    headRows: AdHeadCoachAssignmentRow[]
    assistantRows: AdAssistantCoachAssignmentRow[]
  }
  hints: EngagementHint[]
  /** Team id used for hint counts / dismiss storage (first visible by name, or `teamId` query). */
  hintsContextTeamId: string | null
}

function resolveHintsContextTeamId(
  picklist: { id: string; name: string }[],
  param: string | null
): string | null {
  if (picklist.length === 0) return null
  const visible = new Set(picklist.map((t) => t.id))
  if (param && visible.has(param)) return param
  const sorted = [...picklist].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  )
  return sorted[0]?.id ?? null
}

export type AdBootstrapLoadResult = {
  payload: AdBootstrapPayload
  pageData: AdCoachAssignmentsPageData
}

/**
 * AD Coaches bootstrap: slim team list + coach rows + engagement hints for one context team.
 * Caller must already verify `canAccessAdPortalRoutes` (layout does; API route enforces too).
 */
function toPreloadedTeamBundle(
  bundle: Awaited<ReturnType<typeof fetchAdPortalVisibleTeams>>
): AdPortalPreloadedTeamBundle {
  return {
    scope: bundle.scope,
    orFilter: bundle.orFilter,
    teams: bundle.teams as AdPortalPreloadedTeamBundle["teams"],
    teamsQueryError: bundle.error,
  }
}

export async function loadAdCoachesBootstrapWithMeta(
  supabase: SupabaseClient,
  userId: string,
  viewerRoleUpper: string,
  hintsTeamIdParam: string | null
): Promise<AdBootstrapLoadResult> {
  const teamBundle = await fetchAdPortalVisibleTeams(supabase, userId, "picklist")
  const pageData = await fetchAdCoachAssignmentsPageData(supabase, userId, {
    preloadedTeamBundle: toPreloadedTeamBundle(teamBundle),
  })

  const teams: AdBootstrapTeam[] = pageData.teamsPicklist.map((t) => ({
    id: t.id,
    name: t.name,
    programId: t.programId,
  }))

  const hintsContextTeamId = resolveHintsContextTeamId(pageData.teamsPicklist, hintsTeamIdParam)

  const roleKey = viewerRoleUpper.toUpperCase().replace(/ /g, "_")
  const includeHints = COACH_HINT_ROLES.has(roleKey)

  const hints =
    hintsContextTeamId && includeHints
      ? buildEngagementHints(
          hintsContextTeamId,
          await getCachedEngagementHintCounts(hintsContextTeamId)
        )
      : []

  return {
    pageData,
    payload: {
      teams,
      coaches: {
        headRows: pageData.headRows,
        assistantRows: pageData.assistantRows,
      },
      hints,
      hintsContextTeamId,
    },
  }
}

/** Uncached entry for API when perf debug skips Data Cache. */
export async function loadAdCoachesBootstrapUncached(
  userId: string,
  viewerRoleUpper: string,
  hintsTeamIdParam: string | null
): Promise<AdBootstrapPayload> {
  const { payload } = await loadAdCoachesBootstrapWithMeta(
    getSupabaseServer(),
    userId,
    viewerRoleUpper,
    hintsTeamIdParam
  )
  return payload
}
