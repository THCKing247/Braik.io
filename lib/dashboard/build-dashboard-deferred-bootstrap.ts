import type { ResolvedTeamAccess } from "@/lib/auth/team-access-resolve"
import type { SessionUser } from "@/lib/auth/server-auth"
import type {
  DashboardBootstrapDeferredCorePayload,
  DashboardBootstrapDeferredHeavyPayload,
} from "@/lib/dashboard/dashboard-bootstrap-types"
import type { TeamAnnouncementRow } from "@/lib/team-announcements"
import { getCachedDashboardBootstrapData } from "@/lib/dashboard/build-dashboard-bootstrap-data"
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

/** Home slice (games, calendar, readiness summary) + roster + notifications + announcements + readiness detail — no depth chart. */
export async function buildDashboardBootstrapDeferredCoreData(
  teamId: string,
  userId: string,
  access: ResolvedTeamAccess,
  sessionUser: SessionUser,
  appOrigin: string
): Promise<DashboardBootstrapDeferredCorePayload> {
  const canCoach = access.canEditRoster

  const [dashboard, roster, notifications, announcements, readinessDetail] = await Promise.all([
    getCachedDashboardBootstrapData(teamId, userId, canCoach),
    loadTeamRosterForBootstrap(teamId, sessionUser, appOrigin).catch((e) => {
      console.error("[buildDashboardBootstrapDeferredCoreData] roster", e)
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
      console.error("[buildDashboardBootstrapDeferredCoreData] notifications", e)
      return { notifications: [], unreadCount: 0, hasMore: false }
    }),
    getCachedVisibleTeamAnnouncements(teamId, access.membership.role).catch((e): TeamAnnouncementRow[] => {
      console.error("[buildDashboardBootstrapDeferredCoreData] announcements", e)
      return []
    }),
    canCoach
      ? computeTeamReadinessPayload(teamId, false).catch((e) => {
          console.error("[buildDashboardBootstrapDeferredCoreData] readinessDetail", e)
          return null
        })
      : Promise.resolve(null),
  ])

  return {
    dashboard,
    roster,
    notifications,
    announcements: announcements as TeamAnnouncementRow[],
    readinessDetail,
    generatedAt: new Date().toISOString(),
  }
}

export function getCachedDashboardBootstrapDeferredCore(
  teamId: string,
  userId: string,
  access: ResolvedTeamAccess,
  sessionUser: SessionUser,
  appOrigin: string
): Promise<DashboardBootstrapDeferredCorePayload> {
  return lightweightCached(
    ["dashboard-bootstrap-deferred-core-v1", teamId, userId, access.canEditRoster ? "coach" : "noncoach"],
    {
      revalidate: LW_TTL_DASHBOARD_BOOTSTRAP,
      tags: [
        tagTeamDashboardBootstrap(teamId),
        tagTeamAnnouncements(teamId),
        tagNotificationsUserTeam(userId, teamId),
      ],
    },
    () => buildDashboardBootstrapDeferredCoreData(teamId, userId, access, sessionUser, appOrigin)
  )
}

export async function buildDashboardBootstrapDeferredHeavyData(teamId: string): Promise<DashboardBootstrapDeferredHeavyPayload> {
  const depthEntries = await loadDepthChartForBootstrap(teamId).catch((e) => {
    console.error("[buildDashboardBootstrapDeferredHeavyData] depthChart", e)
    return []
  })
  return {
    depthChart: { entries: depthEntries },
    generatedAt: new Date().toISOString(),
  }
}

export function getCachedDashboardBootstrapDeferredHeavy(teamId: string): Promise<DashboardBootstrapDeferredHeavyPayload> {
  return lightweightCached(
    ["dashboard-bootstrap-deferred-heavy-v1", teamId],
    {
      revalidate: LW_TTL_DASHBOARD_BOOTSTRAP,
      tags: [tagTeamDashboardBootstrap(teamId)],
    },
    () => buildDashboardBootstrapDeferredHeavyData(teamId)
  )
}
