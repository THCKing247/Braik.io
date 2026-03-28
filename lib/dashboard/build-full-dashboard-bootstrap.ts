import type { ResolvedTeamAccess } from "@/lib/auth/team-access-resolve"
import type { SessionUser } from "@/lib/auth/server-auth"
import type { RequestUserLite } from "@/lib/auth/server-auth"
import { buildAppBootstrapPayloadLite } from "@/lib/app/build-app-bootstrap"
import {
  buildMinimalDashboardBootstrapPayload,
  getCachedMinimalDashboardBootstrapPayload,
} from "@/lib/dashboard/build-dashboard-bootstrap-data"
import type { FullDashboardBootstrapPayload } from "@/lib/dashboard/dashboard-bootstrap-types"
import {
  buildDashboardBootstrapDeferredCoreData,
  buildDashboardBootstrapDeferredHeavyData,
  getCachedDashboardBootstrapDeferredCore,
  getCachedDashboardBootstrapDeferredHeavy,
} from "@/lib/dashboard/build-dashboard-deferred-bootstrap"
import {
  mergeDashboardBootstrapDeferredCore,
  mergeDashboardBootstrapDeferredHeavy,
} from "@/lib/dashboard/merge-dashboard-bootstrap"
import type { BootstrapTimingSink } from "@/lib/debug/bootstrap-timing"
import { timedBootstrap } from "@/lib/debug/bootstrap-timing"
import { lightweightCached, LW_TTL_DASHBOARD_BOOTSTRAP, tagTeamDashboardBootstrap } from "@/lib/cache/lightweight-get-cache"

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
 * First paint: lite shell + minimal `dashboard` (team header only; empty games/calendar; readiness skipped).
 * Deferred core fills the full home slice + roster + previews; deferred heavy adds depth chart.
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
  const dashboardPromise = timing
    ? timedBootstrap(timing, "dashboard_minimal", () => buildMinimalDashboardBootstrapPayload(teamId))
    : getCachedMinimalDashboardBootstrapPayload(teamId)

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
    deferredHeavyPending: true,
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
    ["dashboard-bootstrap-light-v2", teamId, userId, access.canEditRoster ? "coach" : "noncoach"],
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

/** Single GET: minimal light + cached core + cached heavy (full dashboard snapshot). */
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
    getCachedDashboardBootstrapDeferredCore(teamId, userId, access, sessionUser, appOrigin),
    getCachedDashboardBootstrapDeferredHeavy(teamId),
  ]).then(([light, core, heavy]) =>
    mergeDashboardBootstrapDeferredHeavy(mergeDashboardBootstrapDeferredCore(light, core), heavy)
  )
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
  const core = timing
    ? await timedBootstrap(timing, "deferred_core", () =>
        buildDashboardBootstrapDeferredCoreData(teamId, userId, access, sessionUser, appOrigin)
      )
    : await buildDashboardBootstrapDeferredCoreData(teamId, userId, access, sessionUser, appOrigin)
  const heavy = timing
    ? await timedBootstrap(timing, "deferred_heavy", () => buildDashboardBootstrapDeferredHeavyData(teamId))
    : await buildDashboardBootstrapDeferredHeavyData(teamId)
  return mergeDashboardBootstrapDeferredHeavy(mergeDashboardBootstrapDeferredCore(light, core), heavy)
}
