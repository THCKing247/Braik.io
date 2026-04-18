import type { SupabaseClient } from "@supabase/supabase-js"
import { presignedGetObjectUrl, readR2Env } from "@/lib/video/r2-client"

export type ExternalRecruitingLink = {
  kind: "external"
  videoType: string
  url: string
  sortOrder: number
}

export type BraikRecruitingVideo = {
  kind: "braik_video"
  id: string
  title: string | null
  playbackUrl: string | null
  durationSeconds: number | null
  createdAt: string | null
}

export type BraikRecruitingClip = {
  kind: "braik_clip"
  id: string
  title: string | null
  playbackUrl: string | null
  startMs: number
  endMs: number
  parentVideoTitle: string | null
  createdAt: string | null
}

export type RecruitingFilmPayload = {
  externalLinks: ExternalRecruitingLink[]
  braikVideos: BraikRecruitingVideo[]
  braikClips: BraikRecruitingClip[]
}

/**
 * Loads recruiter-visible media for a player: external links plus non-private Braik team film/clips
 * for the player's current team. Presigns R2 keys when configured.
 */
export async function loadRecruitingFilmPayload(
  supabase: SupabaseClient,
  playerId: string,
  teamId: string | null
): Promise<RecruitingFilmPayload> {
  const { data: linkRows } = await supabase
    .from("player_video_links")
    .select("video_type, url, sort_order")
    .eq("player_id", playerId)
    .order("sort_order")

  const externalLinks: ExternalRecruitingLink[] = (linkRows ?? []).map(
    (r: { video_type: string; url: string; sort_order: number }) => ({
      kind: "external" as const,
      videoType: r.video_type,
      url: r.url,
      sortOrder: r.sort_order,
    }),
  )

  const braikVideos: BraikRecruitingVideo[] = []
  const braikClips: BraikRecruitingClip[] = []

  if (!teamId) {
    return { externalLinks, braikVideos, braikClips }
  }

  const r2Ok = readR2Env()

  const { data: videos } = await supabase
    .from("game_videos")
    .select("id, title, storage_key, duration_seconds, created_at")
    .eq("team_id", teamId)
    .eq("is_private", false)
    .eq("upload_status", "ready")
    .order("created_at", { ascending: false })
    .limit(80)

  for (const row of videos ?? []) {
    const id = (row as { id: string }).id
    const title = (row as { title?: string | null }).title ?? null
    const key = (row as { storage_key?: string | null }).storage_key
    const playbackUrl = r2Ok && key ? await presignedGetObjectUrl(key) : null
    braikVideos.push({
      kind: "braik_video",
      id,
      title,
      playbackUrl,
      durationSeconds: (row as { duration_seconds?: number | null }).duration_seconds ?? null,
      createdAt: (row as { created_at?: string }).created_at ?? null,
    })
  }

  const { data: clips } = await supabase
    .from("video_clips")
    .select("id, title, start_ms, end_ms, game_video_id, created_at")
    .eq("team_id", teamId)
    .eq("is_private", false)
    .order("created_at", { ascending: false })
    .limit(120)

  const gvIds = [...new Set((clips ?? []).map((c) => (c as { game_video_id: string }).game_video_id))]
  if (gvIds.length === 0) {
    return { externalLinks, braikVideos, braikClips }
  }

  const { data: parents } = await supabase
    .from("game_videos")
    .select("id, title, storage_key, upload_status, is_private")
    .in("id", gvIds)

  const parentMap = new Map<
    string,
    { title: string | null; storage_key: string | null; ok: boolean }
  >()
  for (const p of parents ?? []) {
    const id = (p as { id: string }).id
    const uploadStatus = (p as { upload_status?: string }).upload_status
    const isPrivate = Boolean((p as { is_private?: boolean }).is_private)
    const ok = uploadStatus === "ready" && !isPrivate
    parentMap.set(id, {
      title: (p as { title?: string | null }).title ?? null,
      storage_key: (p as { storage_key?: string | null }).storage_key ?? null,
      ok,
    })
  }

  for (const c of clips ?? []) {
    const gid = (c as { game_video_id: string }).game_video_id
    const parent = parentMap.get(gid)
    if (!parent?.ok || !parent.storage_key) continue
    const playbackUrl = r2Ok ? await presignedGetObjectUrl(parent.storage_key) : null
    braikClips.push({
      kind: "braik_clip",
      id: (c as { id: string }).id,
      title: (c as { title?: string | null }).title ?? null,
      playbackUrl,
      startMs: (c as { start_ms: number }).start_ms,
      endMs: (c as { end_ms: number }).end_ms,
      parentVideoTitle: parent.title,
      createdAt: (c as { created_at?: string }).created_at ?? null,
    })
  }

  return { externalLinks, braikVideos, braikClips }
}
