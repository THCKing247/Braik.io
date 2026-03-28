const STORAGE_KEY = "braik_dashboard_active_team_v1"

export function rememberActiveDashboardTeam(teamId: string): void {
  try {
    const t = teamId.trim()
    if (!t || typeof sessionStorage === "undefined") return
    sessionStorage.setItem(STORAGE_KEY, t)
  } catch {
    /* ignore quota / private mode */
  }
}

export function readActiveDashboardTeamHint(): string | null {
  try {
    if (typeof sessionStorage === "undefined") return null
    return sessionStorage.getItem(STORAGE_KEY)?.trim() || null
  } catch {
    return null
  }
}
