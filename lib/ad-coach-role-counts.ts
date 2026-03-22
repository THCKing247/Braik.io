import type { SupabaseClient } from "@supabase/supabase-js"
import { isAssistantCoachRole, isHeadCoachRole } from "@/lib/team-staff"

/**
 * Counts active `team_members` rows on AD-visible teams by coach level (normalized role).
 * Head vs assistant only; other staff roles are excluded from both counts.
 */
export async function fetchAdCoachRoleCountsByLevel(
  supabase: SupabaseClient,
  teamIds: string[]
): Promise<{ headCoachCount: number; assistantCoachCount: number }> {
  if (teamIds.length === 0) {
    return { headCoachCount: 0, assistantCoachCount: 0 }
  }

  const { data: rows, error } = await supabase
    .from("team_members")
    .select("role")
    .in("team_id", teamIds)
    .eq("active", true)

  if (error) {
    console.warn("[ad-coach-role-counts] team_members query failed", error.message)
    return { headCoachCount: 0, assistantCoachCount: 0 }
  }

  let headCoachCount = 0
  let assistantCoachCount = 0
  for (const r of rows ?? []) {
    const role = (r as { role?: string | null }).role
    if (isHeadCoachRole(role)) headCoachCount += 1
    else if (isAssistantCoachRole(role)) assistantCoachCount += 1
  }

  return { headCoachCount, assistantCoachCount }
}
