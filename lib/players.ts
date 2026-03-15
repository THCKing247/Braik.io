import type { SupabaseClient } from "@supabase/supabase-js"

export type PlayerForUser = {
  id: string
  team_id: string
}

/**
 * Returns the player record linked to the given user (players.user_id).
 * When teamId is provided, returns only the player for that team; otherwise returns any linked player.
 * Used to determine if a user has claimed a roster profile.
 */
export async function getPlayerForUser(
  supabase: SupabaseClient,
  userId: string,
  teamId?: string
): Promise<PlayerForUser | null> {
  if (!userId) return null

  let query = supabase
    .from("players")
    .select("id, team_id")
    .eq("user_id", userId)

  if (teamId) {
    query = query.eq("team_id", teamId)
  }

  const { data, error } = await query.maybeSingle()
  if (error || !data) return null
  return data as PlayerForUser
}
