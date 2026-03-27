/**
 * DB work for dashboard bootstrap (team + games + calendar + readiness).
 * Notifications and announcements are intentionally omitted — cards load them after first paint.
 */
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  lightweightCached,
  LW_TTL_DASHBOARD_BOOTSTRAP,
  LW_TTL_READINESS_SUMMARY,
  tagTeamDashboardBootstrap,
  tagTeamReadinessSummary,
} from "@/lib/cache/lightweight-get-cache"
import { mapDbGameRowToTeamGameRow } from "@/lib/team-game-row-map"
import { computeTeamReadinessPayload } from "@/lib/server/compute-team-readiness"
import type { DashboardBootstrapPayload } from "@/lib/dashboard/dashboard-bootstrap-types"
import type { BootstrapTimingSink } from "@/lib/debug/bootstrap-timing"
import { timedBootstrap } from "@/lib/debug/bootstrap-timing"

const READINESS_CACHE_KEY = "braik-team-readiness-summary-v4"

/** Games columns needed for banner record + next-game card (scores/quarters for outcomes; no game_type / confirmed_by_coach on home). */
const GAMES_SELECT_BOOTSTRAP =
  "id, opponent, game_date, location, result, notes, conference_game, team_score, opponent_score, season_id, seasons(year), q1_home, q2_home, q3_home, q4_home, q1_away, q2_away, q3_away, q4_away"

/**
 * Fetches team row + games + optional readiness. Caller must have already authorized the user for teamId.
 * `userId` + `canEditRoster` are part of the outer cache key so coach vs player payloads never mix.
 */
export async function buildDashboardBootstrapData(
  teamId: string,
  canEditRoster: boolean,
  timing: BootstrapTimingSink | null
): Promise<DashboardBootstrapPayload> {
  const supabase = getSupabaseServer()

  const readinessPromise = canEditRoster
    ? timedBootstrap(timing, "readiness", () =>
        lightweightCached(
          [READINESS_CACHE_KEY, teamId],
          {
            revalidate: LW_TTL_READINESS_SUMMARY,
            /**
             * Shared key with GET …/readiness?summaryOnly=1. Tag dashboard so roster edits that
             * invalidate the home payload also drop this nested entry; tag readiness for targeted API refresh.
             */
            tags: [tagTeamReadinessSummary(teamId), tagTeamDashboardBootstrap(teamId)],
          },
          () => computeTeamReadinessPayload(teamId, true)
        )
      )
    : Promise.resolve(null)

  const [teamRow, gamesResult, calendarResult, readinessPayload] = await Promise.all([
    timedBootstrap(timing, "team", async () =>
      supabase
        .from("teams")
        .select("id, name, slogan, sport, season_name, logo_url, program_id, team_level")
        .eq("id", teamId)
        .maybeSingle()
    ),
    timedBootstrap(timing, "games", async () =>
      supabase
        .from("games")
        .select(GAMES_SELECT_BOOTSTRAP)
        .eq("team_id", teamId)
        .order("game_date", { ascending: true })
    ),
    timedBootstrap(timing, "calendar_events", async () =>
      supabase
        .from("events")
        .select("id, event_type, title, start, end, location")
        .eq("team_id", teamId)
        .order("start", { ascending: true })
    ),
    readinessPromise,
  ])

  if (teamRow.error || !teamRow.data) {
    throw new Error("TEAM_NOT_FOUND")
  }

  if (gamesResult.error) {
    throw new Error(`GAMES_QUERY_FAILED:${gamesResult.error.message}`)
  }

  if (calendarResult.error) {
    throw new Error(`CALENDAR_QUERY_FAILED:${calendarResult.error.message}`)
  }

  const t = teamRow.data as Record<string, unknown>
  const games = (gamesResult.data ?? []).map((r: Record<string, unknown>) => mapDbGameRowToTeamGameRow(r))

  const calendarEvents = (calendarResult.data ?? []).map((e: Record<string, unknown>) => ({
    id: e.id as string,
    type: (e.event_type as string) ?? "CUSTOM",
    title: (e.title as string) ?? "",
    start: e.start as string,
    end: e.end as string,
    location: (e.location as string | null) ?? null,
  }))

  let readiness: DashboardBootstrapPayload["readiness"]
  if (canEditRoster && readinessPayload?.summary) {
    const s = readinessPayload.summary
    readiness = {
      summary: {
        total: s.total,
        incompleteCount: s.incompleteCount,
        readyCount: s.readyCount,
      },
    }
  } else {
    readiness = { skipped: true }
  }

  return {
    team: {
      id: t.id as string,
      name: (t.name as string) ?? "",
      slogan: (t.slogan as string | null) ?? null,
      sport: (t.sport as string) ?? "football",
      seasonName: (t.season_name as string) ?? "",
      logoUrl: (t.logo_url as string | null) ?? null,
      programId: (t.program_id as string | null) ?? null,
      teamLevel: (t.team_level as string | null) ?? null,
    },
    games,
    calendarEvents,
    readiness,
  }
}

/**
 * Short-lived Data Cache for the team-scoped bootstrap payload.
 * Key includes userId + canEditRoster so responses never leak across users or coach/player views.
 */
export function getCachedDashboardBootstrapData(
  teamId: string,
  userId: string,
  canEditRoster: boolean
): Promise<DashboardBootstrapPayload> {
  return lightweightCached(
    /** userId + role bucket: same team row/games for everyone, but readiness slice differs for coaches. */
    ["dashboard-bootstrap-payload-v2", teamId, userId, canEditRoster ? "coach" : "noncoach"],
    {
      revalidate: LW_TTL_DASHBOARD_BOOTSTRAP,
      tags: [tagTeamDashboardBootstrap(teamId)],
    },
    () => buildDashboardBootstrapData(teamId, canEditRoster, null)
  )
}
