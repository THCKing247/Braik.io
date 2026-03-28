import type { TeamGameRow } from "@/lib/team-schedule-games"
import type { AppBootstrapPayload } from "@/lib/app/app-bootstrap-types"
import type { NotificationsApiPayload } from "@/lib/notifications/notifications-api-query"
import type { TeamAnnouncementRow } from "@/lib/team-announcements"
import type { DepthChartBootstrapEntry } from "@/lib/roster/load-depth-chart-for-bootstrap"
import type { PlayerReadinessItem, TeamReadinessSummary } from "@/lib/server/compute-team-readiness"

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
 * Contract for GET /api/dashboard/bootstrap* — shared by routes and the portal dashboard client.
 * Team header, games, calendar preview rows, and coach readiness summary live in bootstrap-light.
 * Roster, depth chart, notification rows, announcements, and readiness detail load via bootstrap-deferred (merged client-side).
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

/** Full coach readiness (per-player rows) — coaches only; null for players/parents. */
export type DashboardReadinessDetailPayload = {
  summary: TeamReadinessSummary
  players?: PlayerReadinessItem[]
}

/**
 * GET /api/dashboard/bootstrap — extended payload for React Query + single round-trip.
 * Includes shell (nav), dashboard home slice, roster, depth chart, notifications preview, announcements, optional full readiness.
 */
export type FullDashboardBootstrapPayload = {
  shell: AppBootstrapPayload
  dashboard: DashboardBootstrapPayload
  roster: unknown[]
  depthChart: { entries: DepthChartBootstrapEntry[] }
  notifications: NotificationsApiPayload
  announcements: TeamAnnouncementRow[]
  readinessDetail: DashboardReadinessDetailPayload | null
  generatedAt: string
  /**
   * When true, `roster` / previews are placeholders; client should merge
   * GET /api/dashboard/bootstrap-deferred (or await full bootstrap) before relying on roster.
   */
  deferredPending?: boolean
}

/** Deferred half merged into {@link FullDashboardBootstrapPayload} after first paint. */
export type DashboardBootstrapDeferredPayload = {
  roster: unknown[]
  depthChart: { entries: DepthChartBootstrapEntry[] }
  notifications: NotificationsApiPayload
  announcements: TeamAnnouncementRow[]
  readinessDetail: DashboardReadinessDetailPayload | null
  generatedAt: string
}
