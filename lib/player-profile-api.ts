/**
 * Shared player profile transform and validation for API and consumers.
 * Single source of truth for DB row -> profile shape and PATCH validation.
 */

import { normalizePlayerImageUrl } from "@/lib/player-image-url"
import type { PlayerProfile } from "@/types/player-profile"
import { PLAYER_SELF_EDIT_FIELDS } from "@/types/player-profile"

export type DbPlayerRow = {
  id: string
  team_id: string
  first_name: string
  last_name: string
  grade: number | null
  jersey_number: number | null
  position_group: string | null
  status: string
  notes: string | null
  image_url: string | null
  user_id: string | null
  email: string | null
  weight: number | null
  height: string | null
  health_status?: string | null
  preferred_name?: string | null
  secondary_position?: string | null
  graduation_year?: number | null
  date_of_birth?: string | null
  school?: string | null
  parent_guardian_contact?: string | null
  player_phone?: string | null
  sms_opt_in?: boolean | null
  address?: string | null
  emergency_contact?: string | null
  emergency_contact_relationship?: string | null
  medical_notes?: string | null
  medical_alerts?: string | null
  eligibility_status?: string | null
  suspension_end_date?: string | null
  role_depth_notes?: string | null
  season_stats?: unknown
  game_stats?: unknown
  practice_metrics?: unknown
  coach_notes?: string | null
  assigned_equipment?: unknown
  equipment_issue_return_notes?: string | null
  profile_tags?: unknown
  profile_notes?: string | null
  document_refs?: unknown
  invite_code?: string | null
  max_bench_lbs?: number | null
  max_squat_lbs?: number | null
  max_power_clean_lbs?: number | null
  max_deadlift_lbs?: number | null
}

export type AssignedEquipmentItemRow = {
  id: string
  category: string | null
  name: string
  condition: string | null
  status: string | null
  notes: string | null
  damage_report_text?: string | null
  damage_reported_at?: string | null
  damage_reported_by_player_id?: string | null
}

/** Map DB player row + team metadata + assigned inventory items to PlayerProfile. */
export function mapRowToProfile(
  row: DbPlayerRow,
  team: { name: string | null; parentCode?: string | null },
  assignedEquipmentItems: AssignedEquipmentItemRow[]
): PlayerProfile {
  const tags = normalizeProfileTags(row.profile_tags)
  return {
    id: row.id,
    teamId: row.team_id,
    teamName: team.name ?? null,
    parentCode: team.parentCode ?? null,
    inviteCode: row.invite_code ?? null,
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    preferredName: row.preferred_name ?? null,
    jerseyNumber: row.jersey_number ?? null,
    position: row.position_group ?? null,
    secondaryPosition: row.secondary_position ?? null,
    graduationYear: row.graduation_year ?? null,
    schoolGrade: row.grade ?? null,
    height: row.height ?? null,
    weight: row.weight ?? null,
    dateOfBirth: row.date_of_birth != null ? String(row.date_of_birth) : null,
    school: row.school ?? null,
    parentGuardianContact: row.parent_guardian_contact ?? null,
    playerEmail: row.email ?? null,
    playerPhone: row.player_phone ?? null,
    smsTransactionalOptIn: Boolean(row.sms_opt_in),
    address: row.address ?? null,
    emergencyContact: row.emergency_contact ?? null,
    emergencyContactRelationship: row.emergency_contact_relationship ?? null,
    medicalNotes: row.medical_notes ?? null,
    medicalAlerts: row.medical_alerts ?? null,
    activeStatus: row.status ?? "active",
    suspensionEndDate:
      row.suspension_end_date != null && String(row.suspension_end_date).trim()
        ? String(row.suspension_end_date).slice(0, 10)
        : null,
    roleDepthNotes: row.role_depth_notes ?? null,
    eligibilityStatus: row.eligibility_status ?? null,
    seasonStats: normalizeJsonRecord(row.season_stats),
    gameStats: Array.isArray(row.game_stats) ? row.game_stats : [],
    practiceMetrics: normalizeJsonRecord(row.practice_metrics),
    coachNotes: row.coach_notes ?? null,
    assignedItems: assignedEquipmentItems.map((i) => ({
      id: i.id,
      category: i.category ?? undefined,
      name: i.name ?? "",
      condition: i.condition ?? undefined,
      status: i.status ?? undefined,
      notes: i.notes ?? null,
      damageReportText: i.damage_report_text ?? null,
      damageReportedAt: i.damage_reported_at ?? null,
      damageReportedByPlayerId: i.damage_reported_by_player_id ?? null,
    })),
    assignedEquipment: normalizeJsonRecord(row.assigned_equipment),
    equipmentIssueReturnNotes: row.equipment_issue_return_notes ?? null,
    notes: row.notes ?? null,
    profileNotes: row.profile_notes ?? null,
    tags,
    documentRefs: Array.isArray(row.document_refs) ? row.document_refs : [],
    imageUrl: normalizePlayerImageUrl(row.image_url) ?? null,
    healthStatus: (row.health_status as "active" | "injured" | "unavailable") ?? "active",
    userId: row.user_id ?? null,
    weightRoomMaxes:
      row.max_bench_lbs != null ||
      row.max_squat_lbs != null ||
      row.max_power_clean_lbs != null ||
      row.max_deadlift_lbs != null
        ? {
            benchLbs: row.max_bench_lbs ?? null,
            squatLbs: row.max_squat_lbs ?? null,
            cleanLbs: row.max_power_clean_lbs ?? null,
            deadliftLbs: row.max_deadlift_lbs ?? null,
          }
        : null,
  }
}

function normalizeJsonRecord(value: unknown): Record<string, unknown> {
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

/** Ensure profile_tags from DB is string[]. */
export function normalizeProfileTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((t): t is string => typeof t === "string")
}

/** Validate date string for date_of_birth (YYYY-MM-DD or empty). Returns null for invalid. */
export function validateDateOfBirth(value: unknown): string | null {
  if (value == null || value === "") return null
  const s = String(value).trim()
  if (!s) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!match) return null
  const [, y, m, d] = match
  const year = parseInt(y!, 10)
  const month = parseInt(m!, 10)
  const day = parseInt(d!, 10)
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null
  return s
}

/** Allowed body keys for player self-edit. Coach can send any; player only these. */
export const ALLOWED_SELF_EDIT_KEYS = new Set<string>(PLAYER_SELF_EDIT_FIELDS as unknown as string[])

const SELF_EDIT_EXTRA_KEYS = new Set(["smsTransactionalOptIn"])

/** Filter PATCH body to only allowed keys when requester is not a coach. */
export function filterBodyForPlayerSelfEdit(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of ALLOWED_SELF_EDIT_KEYS) {
    if (key in body) out[key] = body[key]
  }
  for (const key of SELF_EDIT_EXTRA_KEYS) {
    if (key in body) out[key] = body[key]
  }
  return out
}
