/** First segment of React Query keys — use for partial invalidation (`prefix: true`). */
export const messagingQueryRoot = {
  threadsList: "messages-threads",
  unreadTotal: "messaging-unread-total",
  inboxStats: "message-thread-inbox-stats",
} as const

/**
 * Central React Query keys — import these for invalidation so dashboard/messaging stay consistent.
 * Hooks may wrap these factories (e.g. inbox stats normalizes thread ids before calling `messaging.inboxStats`).
 */
export const queryKeys = {
  dashboard: {
    shell: ["braik-dashboard-shell"] as const,
    bootstrap: (teamId: string) => ["dashboard-bootstrap", teamId.trim()] as const,
  },
  messaging: {
    threadsList: (teamId: string) => [messagingQueryRoot.threadsList, teamId] as const,
    unreadTotal: (userId: string, teamId: string) => [messagingQueryRoot.unreadTotal, userId, teamId] as const,
    inboxStats: (userId: string, normalizedThreadIds: readonly string[]) =>
      [messagingQueryRoot.inboxStats, userId, ...normalizedThreadIds] as const,
  },
  /** Reserved for future React Query migrations — roster today is mostly imperative fetch + bootstrap. */
  roster: {
    lite: (teamId: string) => ["roster", "lite", teamId] as const,
  },
  teams: {
    detail: (teamId: string) => ["teams", "detail", teamId] as const,
  },
  payments: {
    coachOverview: (teamId: string) => ["payments", "coach", teamId] as const,
  },
} as const
