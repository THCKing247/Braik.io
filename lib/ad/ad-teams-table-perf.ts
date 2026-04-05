/**
 * Dev / opt-in timing for AD teams-table and related server paths.
 * Enable in production with AD_TEAMS_TABLE_PERF=1.
 *
 * Stages to compare (server):
 * - `getRequestAuth` / `getRequestUserLite` · `auth_getUser` — JWT validation
 * - `buildSessionUserLite` — profiles + users (parallel)
 * - `route` · `parallel_dept_football_ad_access` — one dept read + football + getAdPortalAccess (teams-table)
 * - `route` · `parallel_football_and_ad_access` — legacy label when dept not folded in
 * - `fetchAdPortalVisibleTeams` · `resolve_athletic_director_scope` — org/program linkage (not the teams row scan)
 * - `fetchAdPortalVisibleTeams` · `teams_query` — PostgREST teams list
 * - `loadAdTeamsTableData` · `team_members_coaches` / `invites_pending` / `profiles_full_names` / `js_*`
 *
 * Client (NEXT_PUBLIC_AD_TEAMS_FLOW_PERF=1 or dev): `ad-teams-flow-perf-client` + `authTimingClient` bootstrap markers.
 */
export function shouldLogAdTeamsFlowPerf(): boolean {
  return process.env.NODE_ENV === "development" || process.env.AD_TEAMS_TABLE_PERF === "1"
}

export function adTeamsFlowPerfLog(
  scope: string,
  phase: string,
  ms: number,
  extra?: Record<string, unknown>
): void {
  if (!shouldLogAdTeamsFlowPerf()) return
  console.info(`[ad-teams-flow-perf] ${scope} · ${phase}`, {
    ms: Math.round(ms * 10) / 10,
    ...extra,
  })
}
