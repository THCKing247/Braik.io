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
import { loadMessageThreadsInboxPayload } from "@/lib/messaging/load-message-threads-inbox"
import { getCachedEngagementHintCounts } from "@/lib/engagement/dashboard-hints-data"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  lightweightCached,
  LW_TTL_DASHBOARD_BOOTSTRAP,
  tagTeamDashboardBootstrap,
  tagTeamAnnouncements,
  tagNotificationsUserTeam,
} from "@/lib/cache/lightweight-get-cache"

/**
 * Home slice (games, calendar, readiness summary) + roster + notifications + announcements + coach engagement counts — no depth chart.
 * Independent slices run in parallel via Promise.all (dashboard + roster + …); see `buildDashboardBootstrapData` for parallel team/games/calendar inside the dashboard slice.
 * Full per-player readiness is not loaded here (roster tab uses GET /api/teams/.../readiness).
 * Calendar rows for `dashboard.calendarEvents` use a bounded query via `getCachedCalendarEventsForBootstrap` inside
 * `getCachedDashboardBootstrapData` (see build-dashboard-bootstrap-data).
 * Playbooks browse + team documents lists are loaded on those routes (GET /api/playbooks/summary, GET /api/documents), not here.
 */
export async function buildDashboardBootstrapDeferredCoreData(
  teamId: string,
  userId: string,
  access: ResolvedTeamAccess,
  sessionUser: SessionUser,
  appOrigin: string
): Promise<DashboardBootstrapDeferredCorePayload> {
  const canCoach = access.canEditRoster
  const hintEngagementRoles = new Set(["HEAD_COACH", "ASSISTANT_COACH", "ATHLETIC_DIRECTOR"])
  const roleUpper = access.membership.role.toUpperCase().replace(/ /g, "_")
  const shouldLoadEngagementCounts = hintEngagementRoles.has(roleUpper)

  const timed = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
    const started = performance.now()
    try {
      return await fn()
    } finally {
      console.info(
        `[deferred-core] ${label} teamId=${teamId} ms=${Math.round(performance.now() - started)}`
      )
    }
  }

  const supabase = getSupabaseServer()

  const [dashboard, roster, notifications, announcements, messageThreadsInbox, engagementHintCounts] =
    await Promise.all([
      timed("dashboard", () => getCachedDashboardBootstrapData(teamId, userId, canCoach)),
      timed("roster", () =>
        loadTeamRosterForBootstrap(teamId, sessionUser, appOrigin).catch((e) => {
          console.error("[buildDashboardBootstrapDeferredCoreData] roster", e)
          return []
        })
      ),
      timed("notifications", () =>
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
        })
      ),
      timed("announcements", () =>
        getCachedVisibleTeamAnnouncements(teamId, access.membership.role).catch((e): TeamAnnouncementRow[] => {
          console.error("[buildDashboardBootstrapDeferredCoreData] announcements", e)
          return []
        })
      ),
      timed("message_threads_inbox", () =>
        loadMessageThreadsInboxPayload(supabase, teamId, userId).catch((e) => {
          console.error("[buildDashboardBootstrapDeferredCoreData] messageThreadsInbox", e)
          return null
        })
      ),
      timed("engagement_hint_counts", () =>
        shouldLoadEngagementCounts
          ? getCachedEngagementHintCounts(teamId).catch((e) => {
              console.error("[buildDashboardBootstrapDeferredCoreData] engagementHintCounts", e)
              return null
            })
          : Promise.resolve(null)
      ),
    ])

  return {
    dashboard,
    roster,
    notifications,
    announcements: announcements as TeamAnnouncementRow[],
    readinessDetail: null,
    messageThreadsInbox,
    engagementHintCounts,
    playbooksSummary: [],
    teamDocumentsList: [],
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
    ["dashboard-bootstrap-deferred-core-v5", teamId, userId, access.canEditRoster ? "coach" : "noncoach"],
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