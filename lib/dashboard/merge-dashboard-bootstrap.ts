import type {
  DashboardBootstrapDeferredPayload,
  FullDashboardBootstrapPayload,
} from "@/lib/dashboard/dashboard-bootstrap-types"

export function mergeDashboardBootstrapDeferred(
  light: FullDashboardBootstrapPayload,
  deferred: DashboardBootstrapDeferredPayload
): FullDashboardBootstrapPayload {
  const unread = deferred.notifications.unreadCount ?? light.shell.unreadNotifications
  return {
    ...light,
    roster: deferred.roster,
    depthChart: deferred.depthChart,
    notifications: deferred.notifications,
    announcements: deferred.announcements,
    readinessDetail: deferred.readinessDetail,
    generatedAt: light.generatedAt,
    deferredPending: false,
    shell: {
      ...light.shell,
      unreadNotifications: unread,
      generatedAt: light.shell.generatedAt,
    },
  }
}
