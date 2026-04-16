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
import {
  lightweightCached,
  LW_TTL_DASHBOARD_BOOTSTRAP,
  tagTeamDashboardBootstrap,
} from "@/lib/cache/lightweight-get-cache"
import { isCoachBPlusEntitled } from "@/lib/braik-ai/coach-b-plus-entitlement"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getTrustedAppOriginOrEmpty } from "@/lib/invites/resolve-invite-app-origin"

/** Prefer env-based origin; avoids bad x-forwarded-* hosts. Used for roster join links in bootstrap. */
export function requestAppOrigin(request: Request): string {
  return getTrustedAppOriginOrEmpty(request)
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
  timing: BootstrapTimingSink | null,
  /** When set by cache wrapper, avoids a duplicate Coach B+ entitlement query */
  coachBPlusEntitled?: boolean
): Promise<FullDashboardBootstrapPayload> {
  const dashboardPromise = timing
    ? timedBootstrap(timing, "dashboard_minimal", () => getCachedMinimalDashboardBootstrapPayload(teamId))
    : getCachedMinimalDashboardBootstrapPayload(teamId)

  const shellPayloadIn = {
    ...shellLiteInput({ userId, email, teamId, liteTeamId, liteRole, isPlatformOwner, access }),
    ...(coachBPlusEntitled !== undefined ? { coachBPlusEntitled } : {}),
  }

  const shellCacheKey = [
    "app-bootstrap-lite-v1",
    teamId,
    userId,
    liteRole,
    isPlatformOwner ? "owner" : "not-owner",
    coachBPlusEntitled ? "coachbplus" : "standard",
    access.canEditRoster ? "coach" : "noncoach",
  ]

  const shellCacheConfig = {
    revalidate: 60,
    tags: [tagTeamDashboardBootstrap(teamId)],
  }

  const shellPromise = timing
    ? timedBootstrap(timing, "shell_lite", () =>
        lightweightCached(
          shellCacheKey,
          shellCacheConfig,
          () => buildAppBootstrapPayloadLite(shellPayloadIn)
        )
      )
    : lightweightCached(
        shellCacheKey,
        shellCacheConfig,
        () => buildAppBootstrapPayloadLite(shellPayloadIn)
      )

  /** Minimal dashboard + lite shell load together (not sequential). */
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

export async function getCachedLightFullDashboardBootstrap(
  teamId: string,
  userId: string,
  email: string,
  liteTeamId: string | undefined,
  liteRole: string,
  isPlatformOwner: boolean,
  access: ResolvedTeamAccess
): Promise<FullDashboardBootstrapPayload> {
  const supabase = getSupabaseServer()
  const coachBPlus = await isCoachBPlusEntitled(supabase, teamId, userId, { isPlatformOwner })

  return lightweightCached(
    [
      "dashboard-bootstrap-light-v4",
      teamId,
      userId,
      coachBPlus ? "1" : "0",
      access.canEditRoster ? "coach" : "noncoach",
    ],
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
        null,
        coachBPlus
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
  const [light, core, heavy] = await Promise.all([
    timing
      ? timedBootstrap(timing, "light", () =>
          buildLightFullDashboardBootstrapData(
            teamId,
            userId,
            email,
            liteTeamId,
            liteRole,
            isPlatformOwner,
            access,
            timing
          )
        )
      : buildLightFullDashboardBootstrapData(
          teamId,
          userId,
          email,
          liteTeamId,
          liteRole,
          isPlatformOwner,
          access,
          timing
        ),
    timing
      ? timedBootstrap(timing, "deferred_core", () =>
          buildDashboardBootstrapDeferredCoreData(teamId, userId, access, sessionUser, appOrigin)
        )
      : buildDashboardBootstrapDeferredCoreData(teamId, userId, access, sessionUser, appOrigin),
    timing
      ? timedBootstrap(timing, "deferred_heavy", () => buildDashboardBootstrapDeferredHeavyData(teamId))
      : buildDashboardBootstrapDeferredHeavyData(teamId),
  ])

  return mergeDashboardBootstrapDeferredHeavy(mergeDashboardBootstrapDeferredCore(light, core), heavy)
}