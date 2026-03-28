import type { ResolvedTeamAccess } from "@/lib/auth/team-access-resolve"
import type { SessionUser } from "@/lib/auth/server-auth"
import type { RequestUserLite } from "@/lib/auth/server-auth"
import { buildAppBootstrapPayloadLite } from "@/lib/app/build-app-bootstrap"
import {
  getCachedDashboardBootstrapData,
  buildDashboardBootstrapData,
} from "@/lib/dashboard/build-dashboard-bootstrap-data"
import type { FullDashboardBootstrapPayload } from "@/lib/dashboard/dashboard-bootstrap-types"
import {
  buildDashboardBootstrapDeferredData,
  getCachedDashboardBootstrapDeferred,
} from "@/lib/dashboard/build-dashboard-deferred-bootstrap"
import { mergeDashboardBootstrapDeferred } from "@/lib/dashboard/merge-dashboard-bootstrap"
import type { BootstrapTimingSink } from "@/lib/debug/bootstrap-timing"
import { timedBootstrap } from "@/lib/debug/bootstrap-timing"
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

const shellLiteInput = (args: {
  userId: string
  email: string
  teamId: string
  liteTeamId: string | undefined
  liteRole: string
  isPlatformOwner: boolean
  access: ResolvedTeamAccess
}) => ({
  userId: args.userId,
  email: args.email,
  teamId: args.teamId,
  liteTeamId: args.liteTeamId,
  liteRole: args.liteRole,
  isPlatformOwner: args.isPlatformOwner,
  membership: args.access.membership,
})

/**
 * First paint: dashboard home slice (team, games, calendar, readiness summary) + lite shell.
 * Roster / depth / notification rows / announcements / readiness detail load via deferred route.
 */
export async function buildLightFullDashboardBootstrapData(
  teamId: string,
  userId: string,
  email: string,
  liteTeamId: string | undefined,
  liteRole: string,
  isPlatformOwner: boolean,
  access: ResolvedTeamAccess,
  timing: BootstrapTimingSink | null
): Promise<FullDashboardBootstrapPayload> {
  const canCoach = access.canEditRoster

  const dashboardPromise = timing
    ? buildDashboardBootstrapData(teamId, canCoach, timing)
    : getCachedDashboardBootstrapData(teamId, userId, canCoach)

  const shellPromise = timing
    ? timedBootstrap(timing, "shell_lite", () =>
        buildAppBootstrapPayloadLite(shellLiteInput({ userId, email, teamId, liteTeamId, liteRole, isPlatformOwner, access }))
      )
    : buildAppBootstrapPayloadLite(
        shellLiteInput({ userId, email, teamId, liteTeamId, liteRole, isPlatformOwner, access })
      )

  const [dashboard, shellBase] = await Promise.all([dashboardPromise, shellPromise])

  const unread = shellBase.unreadNotifications

  return {
    shell: shellBase,
    dashboard,
    roster: [],
    depthChart: { entries: [] },
    notifications: { notifications: [], unreadCount: unread, hasMore: false },
    announcements: [],
    readinessDetail: null,
    generatedAt: new Date().toISOString(),
    deferredPending: true,
  }
}

export function getCachedLightFullDashboardBootstrap(
  teamId: string,
  userId: string,
  email: string,
  liteTeamId: string | undefined,
  liteRole: string,
  isPlatformOwner: boolean,
  access: ResolvedTeamAccess
): Promise<FullDashboardBootstrapPayload> {
  return lightweightCached(
    ["dashboard-bootstrap-light-v1", teamId, userId, access.canEditRoster ? "coach" : "noncoach"],
    {
      revalidate: LW_TTL_DASHBOARD_BOOTSTRAP,
      tags: [tagTeamDashboardBootstrap(teamId)],
    },
    () =>
      buildLightFullDashboardBootstrapData(
        teamId,
        userId,
        email,
        liteTeamId,
        liteRole,
        isPlatformOwner,
        access,
        null
      )
  )
}

/** Composes cached light + deferred halves (same DB work as pre-split full bootstrap, better cache granularity). */
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
  return Promise.all([
    getCachedLightFullDashboardBootstrap(
      teamId,
      userId,
      email,
      liteTeamId,
      liteRole,
      isPlatformOwner,
      access
    ),
    getCachedDashboardBootstrapDeferred(teamId, userId, access, sessionUser, appOrigin),
  ]).then(([light, deferred]) => mergeDashboardBootstrapDeferred(light, deferred))
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
  const light = await buildLightFullDashboardBootstrapData(
    teamId,
    userId,
    email,
    liteTeamId,
    liteRole,
    isPlatformOwner,
    access,
    timing
  )
  const deferred = timing
    ? await timedBootstrap(timing, "deferred_slice", () =>
        buildDashboardBootstrapDeferredData(teamId, userId, access, sessionUser, appOrigin)
      )
    : await buildDashboardBootstrapDeferredData(teamId, userId, access, sessionUser, appOrigin)
  return mergeDashboardBootstrapDeferred(light, deferred)
}
