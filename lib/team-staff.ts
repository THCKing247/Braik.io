/**
 * Team staff helpers: team_members.role uses snake_case (head_coach, assistant_coach).
 */

export type TeamMemberStaffRow = {
  user_id: string
  role: string | null | undefined
  is_primary?: boolean | null
}

export function normalizeTeamMemberRole(role: string | null | undefined): string {
  return (role ?? "").trim().toLowerCase().replace(/-/g, "_")
}

export function isHeadCoachRole(role: string | null | undefined): boolean {
  return normalizeTeamMemberRole(role) === "head_coach"
}

export function isAssistantCoachRole(role: string | null | undefined): boolean {
  return normalizeTeamMemberRole(role) === "assistant_coach"
}

/**
 * Resolve display head coach: is_primary head_coach first, else any head_coach row.
 */
export function pickHeadCoachUserId(rows: TeamMemberStaffRow[]): string | null {
  const heads = rows.filter((r) => r?.user_id && isHeadCoachRole(r.role))
  if (heads.length === 0) return null
  const primary = heads.find((r) => r.is_primary === true)
  if (primary) return primary.user_id
  return heads[0]!.user_id
}

export function assistantCoachUserIds(rows: TeamMemberStaffRow[]): string[] {
  return rows.filter((r) => r?.user_id && isAssistantCoachRole(r.role)).map((r) => r.user_id)
}
