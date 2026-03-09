import { getSupabaseServer } from "@/src/lib/supabaseServer"

/**
 * Validate that a player is in the roster for the given team.
 * Used for depth chart permission checks.
 */
export async function validatePlayerInRoster(teamId: string, playerId: string): Promise<boolean> {
  const supabase = getSupabaseServer()

  const { data: player, error } = await supabase
    .from("players")
    .select("id")
    .eq("team_id", teamId)
    .eq("id", playerId)
    .maybeSingle()

  if (error) {
    console.error("[validatePlayerInRoster]", error)
    return false
  }

  return !!player
}
