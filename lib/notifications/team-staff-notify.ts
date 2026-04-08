import type { SupabaseClient } from "@supabase/supabase-js"
import { createNotifications, type NotificationPayload } from "@/lib/utils/notifications"

/** Active staff roles that should receive roster / operational notifications. */
const STAFF_ROLES = ["head_coach", "assistant_coach", "team_admin"] as const

export async function getStaffUserIdsForTeam(
  supabase: SupabaseClient,
  teamId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("active", true)
    .in("role", [...STAFF_ROLES])

  const ids = [...new Set((data ?? []).map((r) => r.user_id).filter(Boolean))] as string[]
  return ids
}

export async function notifyTeamStaff(
  supabase: SupabaseClient,
  teamId: string,
  payload: Omit<NotificationPayload, "teamId" | "targetUserIds">
): Promise<void> {
  const targetUserIds = await getStaffUserIdsForTeam(supabase, teamId)
  if (targetUserIds.length === 0) return
  await createNotifications({
    ...payload,
    teamId,
    targetUserIds,
  })
}
