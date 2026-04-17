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

/** Non-pricing storage and capability summary for UI (coach shell). */
export type VideoEntitlementSummary = {
  tier: string
  storageCapBytes: number
  /** Bytes counted against quota (team-only or pooled program total). */
  storageUsedBytes: number
  /** Raw team bucket usage (always this team uploads). */
  teamUsedBytes: number
  videoCount: number
  clipCount: number
  aiVideoEnabled: boolean
  taggingEnabled: boolean
  crossTeamLibraryEnabled: boolean
  bulkManagementEnabled: boolean
  advancedClipTools: boolean
  sharedStorageScope: "team" | "program"
}

/** Game Video / Clips gating for nav + gated routes (org/team flags + user permissions). */
export type AppBootstrapVideoClips = {
  productEnabled: boolean
  navVisible: boolean
  canViewVideo: boolean
  canUploadVideo: boolean
  canCreateClips: boolean
  canShareClips: boolean
  canDeleteVideo: boolean
  /** Present when product is on and user can view video — for storage bar / caps in Team Video. */
  entitlement?: VideoEntitlementSummary
}

/** Lightweight shell payload — no roster, calendar rows, messages, etc. */
export type AppBootstrapPayload = {
  user: AppBootstrapUser
  team: AppBootstrapTeam
  flags: AppBootstrapTeamFlags
  /** Coach B+ — action tools (calendar mutations, proposals, announcements, depth chart actions). Default false. */
  coachBPlus: boolean
  unreadNotifications: number
  /** Head coach / assistant / AD only; empty counts for others. */
  engagement: {
    counts: HintCounts | null
  }
  videoClips: AppBootstrapVideoClips
  /** ISO timestamp when payload was built (client debugging). */
  generatedAt: string
}
