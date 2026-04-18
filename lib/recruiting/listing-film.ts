import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Players who have at least one external recruiting link OR eligible internal Braik film/clips
 * on their current team (non-private, ready parent video for clips).
 */
export async function getPlayerIdsWithFilmListingSignal(
  supabase: SupabaseClient,
  playerIds: string[]
): Promise<Set<string>> {
  const out = new Set<string>()
  if (playerIds.length === 0) return out

  const { data: linkRows } = await supabase
    .from("player_video_links")
    .select("player_id")
    .in("player_id", playerIds)

  for (const r of linkRows ?? []) {
    const pid = (r as { player_id?: string }).player_id
    if (pid) out.add(pid)
  }

  const { data: players } = await supabase.from("players").select("id, team_id").in("id", playerIds)
  if (!players?.length) return out

  const teamIds = [...new Set(players.map((p) => (p as { team_id?: string }).team_id).filter(Boolean) as string[])]
  if (teamIds.length === 0) return out

  const { data: gvRows } = await supabase
    .from("game_videos")
    .select("team_id")
    .in("team_id", teamIds)
    .eq("is_private", false)
    .eq("upload_status", "ready")

  const teamsWithFullFilm = new Set((gvRows ?? []).map((r) => (r as { team_id: string }).team_id))

  const { data: clipRows } = await supabase
    .from("video_clips")
    .select("team_id, game_video_id")
    .in("team_id", teamIds)
    .eq("is_private", false)

  const parentIds = [...new Set((clipRows ?? []).map((c) => (c as { game_video_id: string }).game_video_id))]
  const teamsWithClipSignal = new Set<string>()
  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from("game_videos")
      .select("id, team_id")
      .in("id", parentIds)
      .eq("is_private", false)
      .eq("upload_status", "ready")

    const eligibleParent = new Set((parents ?? []).map((p) => (p as { id: string }).id))
    for (const c of clipRows ?? []) {
      const gid = (c as { game_video_id: string }).game_video_id
      if (eligibleParent.has(gid)) {
        teamsWithClipSignal.add((c as { team_id: string }).team_id)
      }
    }
  }

  const teamWithAnyFilm = new Set([...teamsWithFullFilm, ...teamsWithClipSignal])

  for (const p of players) {
    const pid = (p as { id: string }).id
    const tid = (p as { team_id?: string }).team_id
    if (tid && teamWithAnyFilm.has(tid)) out.add(pid)
  }

  return out
}
