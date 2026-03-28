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
  return {
    ...light,
    dashboard: core.dashboard,
    roster: core.roster,
    notifications: core.notifications,
    announcements: core.announcements,
    readinessDetail: core.readinessDetail,
    depthChart: { entries: [] },
    deferredPending: false,
    deferredHeavyPending: true,
    generatedAt: light.generatedAt,
    shell: {
      ...light.shell,
      unreadNotifications: unread,
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
