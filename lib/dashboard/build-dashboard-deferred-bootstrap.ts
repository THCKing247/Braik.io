import type { ResolvedTeamAccess } from "@/lib/auth/team-access-resolve"
import type { SessionUser } from "@/lib/auth/server-auth"
import type { DashboardBootstrapDeferredPayload } from "@/lib/dashboard/dashboard-bootstrap-types"
import type { TeamAnnouncementRow } from "@/lib/team-announcements"
import { loadTeamRosterForBootstrap } from "@/lib/roster/load-team-roster-for-bootstrap"
import { loadDepthChartForBootstrap } from "@/lib/roster/load-depth-chart-for-bootstrap"
import { loadNotificationsApiPayload } from "@/lib/notifications/notifications-api-query"
import { getCachedVisibleTeamAnnouncements } from "@/lib/team-announcements/visible-announcements-query"
import { computeTeamReadinessPayload } from "@/lib/server/compute-team-readiness"
import {
  lightweightCached,
  LW_TTL_DASHBOARD_BOOTSTRAP,
  tagTeamDashboardBootstrap,
  tagTeamAnnouncements,
  tagNotificationsUserTeam,
} from "@/lib/cache/lightweight-get-cache"

export async function buildDashboardBootstrapDeferredData(
  teamId: string,
  userId: string,
  access: ResolvedTeamAccess,
  sessionUser: SessionUser,
  appOrigin: string
): Promise<DashboardBootstrapDeferredPayload> {
  const canCoach = access.canEditRoster

  const [roster, depthEntries, notifications, announcements, readinessDetail] = await Promise.all([
    loadTeamRosterForBootstrap(teamId, sessionUser, appOrigin).catch((e) => {
      console.error("[buildDashboardBootstrapDeferredData] roster", e)
      return []
    }),
    loadDepthChartForBootstrap(teamId).catch((e) => {
      console.error("[buildDashboardBootstrapDeferredData] depthChart", e)
      return []
    }),
    loadNotificationsApiPayload({
      userId,
      teamId,
      unreadOnly: true,
      limit: 15,
      offset: 0,
      previewMode: true,
    }).catch((e) => {
      console.error("[buildDashboardBootstrapDeferredData] notifications", e)
      return { notifications: [], unreadCount: 0, hasMore: false }
    }),
    getCachedVisibleTeamAnnouncements(teamId, access.membership.role).catch((e): TeamAnnouncementRow[] => {
      console.error("[buildDashboardBootstrapDeferredData] announcements", e)
      return []
    }),
    canCoach
      ? computeTeamReadinessPayload(teamId, false).catch((e) => {
          console.error("[buildDashboardBootstrapDeferredData] readinessDetail", e)
          return null
        })
      : Promise.resolve(null),
  ])

  return {
    roster,
    depthChart: { entries: depthEntries },
    notifications,
    announcements: announcements as TeamAnnouncementRow[],
    readinessDetail,
    generatedAt: new Date().toISOString(),
  }
}

export function getCachedDashboardBootstrapDeferred(
  teamId: string,
  userId: string,
  access: ResolvedTeamAccess,
  sessionUser: SessionUser,
  appOrigin: string
): Promise<DashboardBootstrapDeferredPayload> {
  return lightweightCached(
    ["dashboard-bootstrap-deferred-v1", teamId, userId, access.canEditRoster ? "coach" : "noncoach"],
    {
      revalidate: LW_TTL_DASHBOARD_BOOTSTRAP,
      tags: [
        tagTeamDashboardBootstrap(teamId),
        tagTeamAnnouncements(teamId),
        tagNotificationsUserTeam(userId, teamId),
      ],
    },
    () => buildDashboardBootstrapDeferredData(teamId, userId, access, sessionUser, appOrigin)
  )
}
