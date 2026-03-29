/**
 * Dev / opt-in timing for AD teams-table and related server paths.
 * Enable in production with AD_TEAMS_TABLE_PERF=1.
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
