import type { HintCounts } from "@/lib/engagement/dashboard-hints-data"

/** Capability flags for nav / gated UI (same semantics as `resolveTeamAccess`). */
export type AppBootstrapTeamFlags = {
  canEditRoster: boolean
  canManageTeam: boolean
  canManageTeamEffective: boolean
  canPostAnnouncements: boolean
  canViewPayments: boolean
}

export type AppBootstrapUser = {
  id: string
  email: string
  role: string
  teamId?: string
  displayName: string | null
  isPlatformOwner: boolean
}

export type AppBootstrapTeam = {
  id: string
  name: string
  logoUrl: string | null
}

/** Lightweight shell payload — no roster, calendar rows, messages, etc. */
export type AppBootstrapPayload = {
  user: AppBootstrapUser
  team: AppBootstrapTeam
  flags: AppBootstrapTeamFlags
  unreadNotifications: number
  /** Head coach / assistant / AD only; empty counts for others. */
  engagement: {
    counts: HintCounts | null
  }
  /** ISO timestamp when payload was built (client debugging). */
  generatedAt: string
}
