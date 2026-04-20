import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  resolvePlayerUuidForTeamRosterSegment,
  resolvePlayerUuidFromPublicRosterSegment,
} from "@/lib/roster/resolve-roster-player-segment"

/** Resolve `[playerId]` dynamic segment from roster API routes (UUID legacy or player_account_id). */
export async function resolveRosterApiPlayerUuid(
  teamId: string | null | undefined,
  segment: string | null | undefined
): Promise<string | null> {
  const s = segment?.trim()
  if (!s) return null
  const supabase = getSupabaseServer()
  const t = teamId?.trim()
  if (t) {
    return resolvePlayerUuidForTeamRosterSegment(supabase, t, s)
  }
  const pub = await resolvePlayerUuidFromPublicRosterSegment(supabase, s)
  return pub?.playerUuid ?? null
}
