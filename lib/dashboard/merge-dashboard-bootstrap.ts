import type {
  DashboardBootstrapDeferredCorePayload,
  DashboardBootstrapDeferredHeavyPayload,
  FullDashboardBootstrapPayload,
} from "@/lib/dashboard/dashboard-bootstrap-types"

export function mergeDashboardBootstrapDeferredCore(
  light: FullDashboardBootstrapPayload,
  core: DashboardBootstrapDeferredCorePayload
): FullDashboardBootstrapPayload {
  const unread = core.notifications.unreadCount ?? light.shell.unreadNotifications
  const engagementCounts = core.engagementHintCounts ?? light.shell.engagement.counts
  return {
    ...light,
    dashboard: core.dashboard,
    roster: core.roster,
    notifications: core.notifications,
    announcements: core.announcements,
    readinessDetail: core.readinessDetail,
    messageThreadsInbox: core.messageThreadsInbox,
    playbooksSummary: core.playbooksSummary,
    teamDocumentsList: core.teamDocumentsList,
    depthChart: { entries: [] },
    deferredPending: false,
    deferredHeavyPending: true,
    generatedAt: light.generatedAt,
    shell: {
      ...light.shell,
      unreadNotifications: unread,
      engagement: {
        counts: engagementCounts,
      },
      generatedAt: light.shell.generatedAt,
    },
  }
}

export function mergeDashboardBootstrapDeferredHeavy(
  payload: FullDashboardBootstrapPayload,
  heavy: DashboardBootstrapDeferredHeavyPayload
): FullDashboardBootstrapPayload {
  return {
    ...payload,
    depthChart: heavy.depthChart,
    deferredHeavyPending: false,
    generatedAt: payload.generatedAt,
  }
}
