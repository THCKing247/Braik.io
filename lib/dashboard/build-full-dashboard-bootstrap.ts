import type { ResolvedTeamAccess } from "@/lib/auth/team-access-resolve"
import type { SessionUser } from "@/lib/auth/server-auth"
import type { RequestUserLite } from "@/lib/auth/server-auth"
import { buildAppBootstrapPayload } from "@/lib/app/build-app-bootstrap"
import type { AppBootstrapPayload } from "@/lib/app/app-bootstrap-types"
import {
  getCachedDashboardBootstrapData,
  buildDashboardBootstrapData,
} from "@/lib/dashboard/build-dashboard-bootstrap-data"
import type { FullDashboardBootstrapPayload } from "@/lib/dashboard/dashboard-bootstrap-types"
import type { TeamAnnouncementRow } from "@/lib/team-announcements"
import type { BootstrapTimingSink } from "@/lib/debug/bootstrap-timing"
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

export function requestAppOrigin(request: Request): string {
  const h = request.headers
  const host = h.get("x-forwarded-host")
  const proto = h.get("x-forwarded-proto")
  if (host && proto) return `${proto}://${host}`
  try {
    return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin || ""
  } catch {
    return process.env.NEXT_PUBLIC_APP_URL || ""
  }
}

export function liteUserToSessionUser(u: RequestUserLite): SessionUser {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    teamId: u.teamId,
    isPlatformOwner: u.isPlatformOwner,
  }
}

export async function buildFullDashboardBootstrapData(
  teamId: string,
  userId: string,
  email: string,
  liteTeamId: string | undefined,
  liteRole: string,
  isPlatformOwner: boolean,
  access: ResolvedTeamAccess,
  sessionUser: SessionUser,
  appOrigin: string,
  timing: BootstrapTimingSink | null
): Promise<FullDashboardBootstrapPayload> {
  const canCoach = access.canEditRoster

  const dashboardPromise = timing
    ? buildDashboardBootstrapData(teamId, canCoach, timing)
    : getCachedDashboardBootstrapData(teamId, userId, canCoach)

  const [
    dashboard,
    shellBase,
    roster,
    depthEntries,
    notifications,
    announcements,
    readinessDetail,
  ] = await Promise.all([
    dashboardPromise,
    buildAppBootstrapPayload({
      userId,
      email,
      teamId,
      liteTeamId,
      liteRole,
      isPlatformOwner,
      membership: access.membership,
    }),
    loadTeamRosterForBootstrap(teamId, sessionUser, appOrigin).catch((e) => {
      console.error("[buildFullDashboardBootstrap] roster", e)
      return []
    }),
    loadDepthChartForBootstrap(teamId).catch((e) => {
      console.error("[buildFullDashboardBootstrap] depthChart", e)
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
      console.error("[buildFullDashboardBootstrap] notifications", e)
      return { notifications: [], unreadCount: 0, hasMore: false }
    }),
    getCachedVisibleTeamAnnouncements(teamId, access.membership.role).catch((e): TeamAnnouncementRow[] => {
      console.error("[buildFullDashboardBootstrap] announcements", e)
      return []
    }),
    canCoach
      ? computeTeamReadinessPayload(teamId, false).catch((e) => {
          console.error("[buildFullDashboardBootstrap] readinessDetail", e)
          return null
        })
      : Promise.resolve(null),
  ])

  const shell: AppBootstrapPayload = {
    ...shellBase,
    unreadNotifications: notifications.unreadCount,
    generatedAt: new Date().toISOString(),
  }

  return {
    shell,
    dashboard,
    roster,
    depthChart: { entries: depthEntries },
    notifications,
    announcements: announcements as TeamAnnouncementRow[],
    readinessDetail,
    generatedAt: new Date().toISOString(),
  }
}

export function getCachedFullDashboardBootstrap(
  teamId: string,
  userId: string,
  email: string,
  liteTeamId: string | undefined,
  liteRole: string,
  isPlatformOwner: boolean,
  access: ResolvedTeamAccess,
  sessionUser: SessionUser,
  appOrigin: string
): Promise<FullDashboardBootstrapPayload> {
  return lightweightCached(
    ["dashboard-bootstrap-full-v1", teamId, userId, access.canEditRoster ? "coach" : "noncoach"],
    {
      revalidate: LW_TTL_DASHBOARD_BOOTSTRAP,
      tags: [
        tagTeamDashboardBootstrap(teamId),
        tagTeamAnnouncements(teamId),
        tagNotificationsUserTeam(userId, teamId),
      ],
    },
    () =>
      buildFullDashboardBootstrapData(
        teamId,
        userId,
        email,
        liteTeamId,
        liteRole,
        isPlatformOwner,
        access,
        sessionUser,
        appOrigin,
        null
      )
  )
}
