import type { TeamGameRow } from "@/lib/team-schedule-games"

/** Minimal rows for `DashboardCalendar` (matches calendar API fields used by the home grid). */
export type DashboardBootstrapCalendarEvent = {
  id: string
  type: string
  title: string
  start: string
  end: string
  location: string | null
}

/**
 * Contract for GET /api/dashboard/bootstrap — shared by the route and the portal dashboard client.
 * Team header, games, calendar preview rows, and coach readiness summary.
 * Notifications and announcements load from their own endpoints after first paint (see route comments).
 */
export type DashboardBootstrapPayload = {
  team: {
    id: string
    name: string
    slogan: string | null
    sport: string
    seasonName: string
    logoUrl: string | null
    programId: string | null
    teamLevel: string | null
  }
  games: TeamGameRow[]
  calendarEvents: DashboardBootstrapCalendarEvent[]
  readiness:
    | { summary: { total: number; incompleteCount: number; readyCount: number } }
    | { skipped: true }
}
