export type ProductHealthSnapshot = {
  organizations: number
  programs: number
  teamsWithRosterCap: number
  coachBEventsInWindow: number
  feedbackInWindow: number
  remindersPending: number
  injuriesActive: number
  playbooksTotal: number
  threadsTouchedInWindow: number
  messagesInWindow: number
  subscriptionsActive: number
  subscriptionsPastDue: number
  usersByRole: { role: string; count: number }[]
  recentSignups: { id: string; createdAt: string; label: string }[]
  recentFeedback: { id: string; category: string; createdAt: string; preview: string }[]
}

export const emptyProductHealth: ProductHealthSnapshot = {
  organizations: 0,
  programs: 0,
  teamsWithRosterCap: 0,
  coachBEventsInWindow: 0,
  feedbackInWindow: 0,
  remindersPending: 0,
  injuriesActive: 0,
  playbooksTotal: 0,
  threadsTouchedInWindow: 0,
  messagesInWindow: 0,
  subscriptionsActive: 0,
  subscriptionsPastDue: 0,
  usersByRole: [],
  recentSignups: [],
  recentFeedback: [],
}
