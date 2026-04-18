import type { SupabaseClient } from "@supabase/supabase-js"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function sanitizePlayerIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null
  const ids = [...new Set(raw.map((x) => String(x).trim()).filter((id) => UUID_RE.test(id)))]
  return ids.slice(0, 80)
}

/** Ensures every id is a player on `teamId`. Throws on mismatch or DB error. */
export async function assertPlayersBelongToTeam(
  supabase: SupabaseClient,
  teamId: string,
  playerIds: string[],
): Promise<void> {
  if (playerIds.length === 0) return
  const { data: rows, error } = await supabase
    .from("players")
    .select("id")
    .eq("team_id", teamId)
    .in("id", playerIds)

  if (error) throw new Error(error.message)

  const ok = new Set((rows ?? []).map((r) => (r as { id: string }).id))
  for (const id of playerIds) {
    if (!ok.has(id)) {
      throw new Error("One or more players are not on this team.")
    }
  }
}

export async function replaceVideoClipPlayers(
  supabase: SupabaseClient,
  videoClipId: string,
  teamId: string,
  rawPlayerIds: unknown,
): Promise<{ playerIds: string[] }> {
  const playerIds = sanitizePlayerIds(rawPlayerIds)
  if (playerIds === null) {
    throw new Error("playerIds must be an array of player UUIDs.")
  }

  await assertPlayersBelongToTeam(supabase, teamId, playerIds)

  const { error: delErr } = await supabase.from("video_clip_players").delete().eq("video_clip_id", videoClipId)
  if (delErr) throw new Error(delErr.message)

  if (playerIds.length > 0) {
    const rows = playerIds.map((player_id) => ({ video_clip_id: videoClipId, player_id }))
    const { error: insErr } = await supabase.from("video_clip_players").insert(rows)
    if (insErr) throw new Error(insErr.message)
  }

  return { playerIds }
}

export async function replaceGameVideoPlayers(
  supabase: SupabaseClient,
  gameVideoId: string,
  teamId: string,
  rawPlayerIds: unknown,
): Promise<{ playerIds: string[] }> {
  const playerIds = sanitizePlayerIds(rawPlayerIds)
  if (playerIds === null) {
    throw new Error("playerIds must be an array of player UUIDs.")
  }

  await assertPlayersBelongToTeam(supabase, teamId, playerIds)

  const { error: delErr } = await supabase.from("game_video_players").delete().eq("game_video_id", gameVideoId)
  if (delErr) throw new Error(delErr.message)

  if (playerIds.length > 0) {
    const rows = playerIds.map((player_id) => ({ game_video_id: gameVideoId, player_id }))
    const { error: insErr } = await supabase.from("game_video_players").insert(rows)
    if (insErr) throw new Error(insErr.message)
  }

  return { playerIds }
}

/** Map clip id → attached player ids (stable order). */
export async function fetchAttachedPlayerIdsForClips(
  supabase: SupabaseClient,
  clipIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  if (clipIds.length === 0) return out

  const { data, error } = await supabase
    .from("video_clip_players")
    .select("video_clip_id, player_id")
    .in("video_clip_id", clipIds)

  if (error) {
    console.error("[fetchAttachedPlayerIdsForClips]", error.message)
    return out
  }

  for (const row of data ?? []) {
    const cid = (row as { video_clip_id: string }).video_clip_id
    const pid = (row as { player_id: string }).player_id
    const prev = out.get(cid) ?? []
    prev.push(pid)
    out.set(cid, prev)
  }

  return out
}

export async function fetchAttachedPlayerIdsForGameVideo(
  supabase: SupabaseClient,
  gameVideoId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("game_video_players")
    .select("player_id")
    .eq("game_video_id", gameVideoId)

  if (error) {
    console.error("[fetchAttachedPlayerIdsForGameVideo]", error.message)
    return []
  }

  return (data ?? []).map((r) => (r as { player_id: string }).player_id)
}
