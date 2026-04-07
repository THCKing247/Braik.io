import type { SupabaseClient } from "@supabase/supabase-js"

/** Resolve roster player ids for a study assignment target. */
export async function resolveAssignmentPlayerIds(
  supabase: SupabaseClient,
  teamId: string,
  assignedToType: "team" | "position_group" | "players",
  assignedPositionGroup: string | null,
  explicitPlayerIds: string[] | null
): Promise<string[]> {
  if (assignedToType === "players" && explicitPlayerIds?.length) {
    const { data } = await supabase
      .from("players")
      .select("id")
      .eq("team_id", teamId)
      .in("id", explicitPlayerIds)
    return (data ?? []).map((r) => r.id)
  }
  if (assignedToType === "position_group" && assignedPositionGroup?.trim()) {
    const { data } = await supabase
      .from("players")
      .select("id")
      .eq("team_id", teamId)
      .eq("position_group", assignedPositionGroup.trim())
      .neq("status", "inactive")
    return (data ?? []).map((r) => r.id)
  }
  const { data } = await supabase
    .from("players")
    .select("id")
    .eq("team_id", teamId)
    .neq("status", "inactive")
  return (data ?? []).map((r) => r.id)
}
