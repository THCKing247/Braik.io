/** Fired when a team's game schedule changes (create / update / delete / import). */
export const TEAM_GAMES_CHANGED_EVENT = "braik:team-games-changed" as const

export type TeamGamesChangedDetail = { teamId: string }

export function emitTeamGamesChanged(teamId: string) {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<TeamGamesChangedDetail>(TEAM_GAMES_CHANGED_EVENT, { detail: { teamId } })
  )
}
