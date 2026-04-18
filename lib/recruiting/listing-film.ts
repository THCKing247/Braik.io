import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Players with film signal for recruiting search/list cards: external links OR
 * eligible attached internal clips/videos (non-private, ready parent) for that player on their team.
 */
export async function getPlayerIdsWithFilmListingSignal(
  supabase: SupabaseClient,
  playerIds: string[],
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
  const teamByPlayer = new Map<string, string>()
  for (const p of players ?? []) {
    const id = (p as { id: string }).id
    const tid = (p as { team_id?: string | null }).team_id
    if (tid) teamByPlayer.set(id, tid)
  }

  const { data: gvAttach } = await supabase
    .from("game_video_players")
    .select("player_id, game_video_id")
    .in("player_id", playerIds)

  const gvIds = [...new Set((gvAttach ?? []).map((r) => (r as { game_video_id: string }).game_video_id))]
  const gvMeta = new Map<string, { team_id: string; eligible: boolean }>()
  if (gvIds.length > 0) {
    const { data: gvRows } = await supabase
      .from("game_videos")
      .select("id, team_id, is_private, upload_status")
      .in("id", gvIds)

    for (const g of gvRows ?? []) {
      const id = (g as { id: string }).id
      const eligible =
        (g as { upload_status?: string }).upload_status === "ready" &&
        !(g as { is_private?: boolean }).is_private
      gvMeta.set(id, {
        team_id: (g as { team_id: string }).team_id,
        eligible,
      })
    }
  }

  for (const row of gvAttach ?? []) {
    const pid = (row as { player_id: string }).player_id
    const gvid = (row as { game_video_id: string }).game_video_id
    const playerTeam = teamByPlayer.get(pid)
    const meta = gvMeta.get(gvid)
    if (!playerTeam || !meta?.eligible || meta.team_id !== playerTeam) continue
    out.add(pid)
  }

  const { data: clipAttach } = await supabase
    .from("video_clip_players")
    .select("player_id, video_clip_id")
    .in("player_id", playerIds)

  const clipIds = [...new Set((clipAttach ?? []).map((r) => (r as { video_clip_id: string }).video_clip_id))]
  if (clipIds.length === 0) {
    return out
  }

  const { data: clipsData } = await supabase
    .from("video_clips")
    .select("id, team_id, is_private, game_video_id")
    .in("id", clipIds)

  const clipById = new Map<string, { team_id: string; is_private: boolean; game_video_id: string }>()
  for (const c of clipsData ?? []) {
    clipById.set((c as { id: string }).id, {
      team_id: (c as { team_id: string }).team_id,
      is_private: Boolean((c as { is_private?: boolean }).is_private),
      game_video_id: (c as { game_video_id: string }).game_video_id,
    })
  }

  const parentIds = [...new Set([...clipById.values()].map((c) => c.game_video_id))]
  const parentOk = new Map<string, boolean>()
  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from("game_videos")
      .select("id, is_private, upload_status")
      .in("id", parentIds)

    for (const p of parents ?? []) {
      const id = (p as { id: string }).id
      const eligible =
        (p as { upload_status?: string }).upload_status === "ready" &&
        !(p as { is_private?: boolean }).is_private
      parentOk.set(id, eligible)
    }
  }

  for (const row of clipAttach ?? []) {
    const pid = (row as { player_id: string }).player_id
    const cid = (row as { video_clip_id: string }).video_clip_id
    const playerTeam = teamByPlayer.get(pid)
    const clip = clipById.get(cid)
    if (!playerTeam || !clip || clip.is_private || clip.team_id !== playerTeam) continue
    if (parentOk.get(clip.game_video_id)) out.add(pid)
  }

  return out
}
