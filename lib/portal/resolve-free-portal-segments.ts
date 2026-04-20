import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizePlayerAccountIdSegment } from "@/lib/roster/resolve-roster-player-segment"

/**
 * Public URL segment for the player portal — numeric `players.player_account_id` (per team uniqueness; globally used as display id).
 */
export async function getPlayerAccountSegmentForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  if (!userId) return null
  const { data, error } = await supabase
    .from("players")
    .select("player_account_id")
    .eq("user_id", userId)
    .maybeSingle()
  if (error || !data) return null
  const raw = (data as { player_account_id?: string | null }).player_account_id
  if (raw == null || String(raw).trim() === "") return null
  return normalizePlayerAccountIdSegment(String(raw))
}

/**
 * Parent portal URL segment: primary linked child's public `player_account_id`.
 * (Future: swap to dedicated parent invite / link code from DB when exposed.)
 */
export async function getParentPortalSegmentForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  if (!userId) return null
  const { data: links, error: linksErr } = await supabase
    .from("parent_player_links")
    .select("player_id")
    .eq("parent_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)

  if (linksErr || !links?.length) return null
  const playerId = (links[0] as { player_id?: string }).player_id
  if (!playerId) return null

  const { data: player, error: pErr } = await supabase
    .from("players")
    .select("player_account_id")
    .eq("id", playerId)
    .maybeSingle()
  if (pErr || !player) return null
  const raw = (player as { player_account_id?: string | null }).player_account_id
  if (raw == null || String(raw).trim() === "") return null
  return normalizePlayerAccountIdSegment(String(raw))
}
