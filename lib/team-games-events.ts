/** Fired when a team's game schedule changes (create / update / delete / import). */
export const TEAM_GAMES_CHANGED_EVENT = "braik:team-games-changed" as const

/**
 * Must match `BRAIK_CALENDAR_EVENTS_CHANGED_EVENT` in `lib/calendar/calendar-events-client`
 * so schedule mutations invalidate the calendar React Query cache and dashboard month grid.
 */
const CALENDAR_EVENTS_CHANGED_EVENT = "braik:calendar-events-changed" as const

export type TeamGamesChangedDetail = { teamId: string }

export function emitTeamGamesChanged(teamId: string) {
  if (typeof window === "undefined") return
  const detail = { teamId }
  window.dispatchEvent(new CustomEvent<TeamGamesChangedDetail>(TEAM_GAMES_CHANGED_EVENT, { detail }))
  window.dispatchEvent(new CustomEvent<{ teamId: string }>(CALENDAR_EVENTS_CHANGED_EVENT, { detail }))
}
