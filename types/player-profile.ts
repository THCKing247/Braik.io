/**
 * Shared player profile types for Coach Portal and Player Portal.
 * Single source of truth: both portals read/write the same player record.
 */

export interface PlayerProfileBasic {
  firstName: string
  lastName: string
  preferredName?: string | null
  jerseyNumber?: number | null
  position?: string | null
  secondaryPosition?: string | null
  graduationYear?: number | null
  /** Academic class as grade 9–12 (Freshman–Senior); distinct from graduation year */
  schoolGrade?: number | null
  height?: string | null
  weight?: number | null
  dateOfBirth?: string | null
  school?: string | null
  /** Plain-text contact info. For relational parent/guardian linkage use guardians + guardian_links (see Docs/PLAYER_PROFILE_PARENT_GUARDIAN.md). */
  parentGuardianContact?: string | null
  playerEmail?: string | null
  playerPhone?: string | null
  /** Transactional SMS opt-in for player_phone (compliance). */
  smsTransactionalOptIn?: boolean
  address?: string | null
  emergencyContact?: string | null
  /** Relationship to player (e.g. Mother) — shown on Health tab */
  emergencyContactRelationship?: string | null
  medicalNotes?: string | null
  /** Short alerts separate from longer medical notes */
  medicalAlerts?: string | null
}

export interface PlayerProfileTeam {
  activeStatus: string
  teamId: string
  teamName?: string | null
  /** Team-level parent join code (shared by all players on the roster). */
  parentCode?: string | null
  roleDepthNotes?: string | null
  eligibilityStatus?: string | null
  /** When roster status is suspended, optional expected end date (YYYY-MM-DD). */
  suspensionEndDate?: string | null
}

export interface PlayerProfileStats {
  seasonStats?: Record<string, unknown>
  gameStats?: unknown[]
  practiceMetrics?: Record<string, unknown>
  coachNotes?: string | null
}

export interface AssignedEquipmentItem {
  id?: string
  category?: string
  name?: string
  condition?: string
  status?: string
  notes?: string | null
  damageReportText?: string | null
  damageReportedAt?: string | null
  damageReportedByPlayerId?: string | null
}

export interface PlayerProfileEquipment {
  assignedItems?: AssignedEquipmentItem[]
  assignedEquipment?: Record<string, unknown>
  equipmentIssueReturnNotes?: string | null
}

export interface PlayerProfileDocuments {
  notes?: string | null
  profileNotes?: string | null
  tags?: string[]
  documentRefs?: unknown[]
}

/** Current weight-room maxes (lbs); synced from player_maxes; display-only on profile. */
export interface WeightRoomMaxesDisplay {
  benchLbs: number | null
  squatLbs: number | null
  cleanLbs: number | null
  deadliftLbs: number | null
}

export interface PlayerProfile extends PlayerProfileBasic, PlayerProfileTeam, PlayerProfileStats, PlayerProfileEquipment, PlayerProfileDocuments {
  id: string
  /** Populated from players.max_* columns; coaches see all; players see own only via API. */
  weightRoomMaxes?: WeightRoomMaxesDisplay | null
  imageUrl?: string | null
  healthStatus?: "active" | "injured" | "unavailable"
  /** Coach-issued code on this roster row; parents use it at parent signup (`/parent/join`). */
  inviteCode?: string | null
  inviteStatus?: "not_invited" | "invited" | "joined"
  userId?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

/** Fields a player is allowed to edit in self-service (Player Portal). */
export const PLAYER_SELF_EDIT_FIELDS = [
  "preferredName",
  "playerEmail",
  "playerPhone",
  "address",
  "emergencyContact",
] as const

export type PlayerSelfEditField = (typeof PLAYER_SELF_EDIT_FIELDS)[number]

/** PATCH body for profile update; coach can send any field, player only self-edit fields. */
export interface PlayerProfileUpdateBody {
  teamId?: string
  preferredName?: string | null
  playerEmail?: string | null
  playerPhone?: string | null
  /** Required when saving a non-empty playerPhone (transactional SMS consent). */
  smsTransactionalOptIn?: boolean
  address?: string | null
  emergencyContact?: string | null
  // Coach-only (ignored when from player)
  firstName?: string | null
  lastName?: string | null
  jerseyNumber?: number | null
  position?: string | null
  secondaryPosition?: string | null
  graduationYear?: number | null
  schoolGrade?: number | null
  height?: string | null
  weight?: number | null
  dateOfBirth?: string | null
  school?: string | null
  parentGuardianContact?: string | null
  medicalNotes?: string | null
  medicalAlerts?: string | null
  emergencyContactRelationship?: string | null
  activeStatus?: string
  /** Expected end of roster suspension (YYYY-MM-DD); cleared when status is not suspended. */
  suspensionEndDate?: string | null
  /** Injury / availability (coach) */
  healthStatus?: "active" | "injured" | "unavailable"
  eligibilityStatus?: string | null
  roleDepthNotes?: string | null
  seasonStats?: Record<string, unknown>
  gameStats?: unknown[]
  practiceMetrics?: Record<string, unknown>
  coachNotes?: string | null
  assignedEquipment?: Record<string, unknown>
  equipmentIssueReturnNotes?: string | null
  profileNotes?: string | null
  profileTags?: string[]
  notes?: string | null
}

/**
 * Guardian linkage (product-level). One guardian can be linked to many players;
 * one player can have many guardians. Use guardians + guardian_links tables.
 * GUARDIAN_ACCESS_HOOK: When allowing profile read for a user, check guardian_links
 * where guardian_id = (guardian row for this user) and player_id = profile player.
 */
export interface GuardianLinkSummary {
  guardianId: string
  playerId: string
  relationship?: string | null
  verified?: boolean
  /** Resolved from guardians.user_id -> users.name */
  guardianName?: string | null
}
