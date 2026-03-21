import { ROLES, type Role } from "@/lib/auth/roles"

const STAFF_ROLES: Role[] = [
  ROLES.HEAD_COACH,
  ROLES.ASSISTANT_COACH,
  ROLES.ATHLETIC_DIRECTOR,
  ROLES.SCHOOL_ADMIN,
]

function normalizedVisibility(v: string | null | undefined): string {
  return (v || "all").toLowerCase().trim()
}

/** Audience column on documents: all | staff | players | parents */
export function documentAudienceVisibleToRole(visibility: string | null | undefined, viewerRole: Role): boolean {
  if (STAFF_ROLES.includes(viewerRole)) return true
  const v = normalizedVisibility(visibility)
  if (v === "all") return true
  if (v === "staff") return false
  if (v === "players") return viewerRole === ROLES.PLAYER
  if (v === "parents") return viewerRole === ROLES.PARENT
  return true
}

function parseAssignedPlayerIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === "string" && x.length > 0)
}

/**
 * Team document list / file access: audience + optional assigned_player_ids (coach-assigned subset).
 */
export function teamDocumentVisibleToMember(params: {
  visibility: string | null | undefined
  assignedPlayerIds: unknown
  viewerRole: Role
  /** Roster player row ids linked to the viewer for this team (empty if not a player). */
  viewerPlayerRowIds: string[]
}): boolean {
  if (!documentAudienceVisibleToRole(params.visibility, params.viewerRole)) return false
  const assigned = parseAssignedPlayerIds(params.assignedPlayerIds)
  if (assigned.length === 0) return true
  if (STAFF_ROLES.includes(params.viewerRole)) return true
  if (params.viewerRole !== ROLES.PLAYER) return false
  return params.viewerPlayerRowIds.some((id) => assigned.includes(id))
}
