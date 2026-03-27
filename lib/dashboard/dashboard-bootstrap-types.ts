import type { TeamGameRow } from "@/lib/team-schedule-games"
import type { TeamAnnouncementRow } from "@/lib/team-announcements"

/**
 * Contract for GET /api/dashboard/bootstrap — shared by the route and the portal dashboard client.
 * One round-trip replaces several per-section API calls while preserving the same auth and RBAC checks.
 */
export type DashboardBootstrapNotification = {
  id: string
  userId: string
  teamId: string
  type: string
  title: string
  body: string | null
  linkUrl: string | null
  linkType: string | null
  linkId: string | null
  metadata: unknown
  read: boolean
  readAt: string | null
  createdAt: string
}

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
  notifications: DashboardBootstrapNotification[]
  notificationsUnreadCount: number
  announcements: TeamAnnouncementRow[]
  readiness:
    | { summary: { total: number; incompleteCount: number; readyCount: number } }
    | { skipped: true }
}
