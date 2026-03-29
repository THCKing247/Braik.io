/**
 * Browser timing for AD teams table (after login → bootstrap → teams-table).
 * Enable: `NEXT_PUBLIC_AD_TEAMS_FLOW_PERF=1`, or `window.__BRAIK_AD_TEAMS_FLOW_PERF__ = true`, or NODE_ENV=development.
 */
export function shouldLogAdTeamsFlowPerfClient(): boolean {
  if (typeof window === "undefined") return false
  if ((window as unknown as { __BRAIK_AD_TEAMS_FLOW_PERF__?: boolean }).__BRAIK_AD_TEAMS_FLOW_PERF__ === true) return true
  if (process.env.NODE_ENV === "development") return true
  return process.env.NEXT_PUBLIC_AD_TEAMS_FLOW_PERF === "1"
}

export function adTeamsFlowPerfClient(label: string, detail?: Record<string, unknown>): void {
  if (!shouldLogAdTeamsFlowPerfClient()) return
  console.info(`[ad-teams-flow-perf-client] ${label}`, {
    t: Math.round(performance.now()),
    ...detail,
  })
}
