import type { SupabaseClient } from "@supabase/supabase-js"

/** Same shape as middleware UUID check — roster URL segment that is a player UUID (legacy). */
export const ROSTER_PLAYER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function rosterPlayerSegmentLooksLikeUuid(segment: string): boolean {
  return ROSTER_PLAYER_UUID_RE.test(segment.trim())
}

/** Normalize numeric short ids so `1245` matches stored `001245`. */
export function normalizePlayerAccountIdSegment(segment: string): string {
  const t = segment.trim()
  if (/^\d+$/.test(t)) return t.padStart(6, "0")
  return t
}

/**
 * Resolve a roster URL or API path segment to `players.id` for the given team.
 * Accepts internal UUID (legacy) or public `player_account_id`.
 */
export async function resolvePlayerUuidForTeamRosterSegment(
  supabase: SupabaseClient,
  teamId: string,
  segment: string
): Promise<string | null> {
  const raw = segment.trim()
  if (!raw) return null

  if (rosterPlayerSegmentLooksLikeUuid(raw)) {
    const { data } = await supabase
      .from("players")
      .select("id")
      .eq("team_id", teamId)
      .eq("id", raw)
      .maybeSingle()
    return (data as { id?: string } | null)?.id ?? null
  }

  const normalizedAccount = normalizePlayerAccountIdSegment(raw)
  const { data } = await supabase
    .from("players")
    .select("id")
    .eq("team_id", teamId)
    .eq("player_account_id", normalizedAccount)
    .maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}

/** Resolve segment when `teamId` is not available (e.g. legacy callers). Uses globally unique `player_account_id`. */
export async function resolvePlayerUuidFromPublicRosterSegment(
  supabase: SupabaseClient,
  segment: string
): Promise<{ playerUuid: string; teamId: string } | null> {
  const raw = segment.trim()
  if (!raw) return null

  if (rosterPlayerSegmentLooksLikeUuid(raw)) {
    const { data } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("id", raw)
      .maybeSingle()
    const row = data as { id?: string; team_id?: string | null } | null
    if (!row?.id || !row.team_id) return null
    return { playerUuid: row.id, teamId: row.team_id }
  }

  const normalizedAccount = normalizePlayerAccountIdSegment(raw)
  const { data } = await supabase
    .from("players")
    .select("id, team_id")
    .eq("player_account_id", normalizedAccount)
    .maybeSingle()
  const row = data as { id?: string; team_id?: string | null } | null
  if (!row?.id || !row.team_id) return null
  return { playerUuid: row.id, teamId: row.team_id }
}
