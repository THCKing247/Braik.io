import type { TeamGameRow } from "@/lib/team-schedule-games"

/**
 * Contract for GET /api/dashboard/bootstrap — shared by the route and the portal dashboard client.
 * Team header, games (banner + next game), and coach readiness summary only.
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
  readiness:
    | { summary: { total: number; incompleteCount: number; readyCount: number } }
    | { skipped: true }
}
