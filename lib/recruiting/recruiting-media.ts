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

async function loadExternalLinks(
  supabase: SupabaseClient,
  playerId: string,
): Promise<ExternalRecruitingLink[]> {
  const { data: linkRows } = await supabase
    .from("player_video_links")
    .select("video_type, url, sort_order")
    .eq("player_id", playerId)
    .order("sort_order")

  return (linkRows ?? []).map((r: { video_type: string; url: string; sort_order: number }) => ({
    kind: "external" as const,
    videoType: r.video_type,
    url: r.url,
    sortOrder: r.sort_order,
  }))
}

type BraikMode = "recruiting" | "player_portal"

/**
 * Braik-hosted film explicitly attached to the player via `game_video_players` / `video_clip_players`.
 * Recruiting mode excludes private clips/videos and non-ready parents (recruiter-safe).
 * Player portal mode shows all attached media the player can stream (ready parent file; privacy flags only affect recruiting).
 */
async function loadAttachedBraikMedia(
  supabase: SupabaseClient,
  playerId: string,
  teamId: string,
  mode: BraikMode,
): Promise<{ braikVideos: BraikRecruitingVideo[]; braikClips: BraikRecruitingClip[] }> {
  const braikVideos: BraikRecruitingVideo[] = []
  const braikClips: BraikRecruitingClip[] = []
  const r2Ok = readR2Env()

  const { data: gvAttach } = await supabase
    .from("game_video_players")
    .select("game_video_id")
    .eq("player_id", playerId)

  const gvIdsFull = [...new Set((gvAttach ?? []).map((r) => (r as { game_video_id: string }).game_video_id))]
  if (gvIdsFull.length > 0) {
    let q = supabase
      .from("game_videos")
      .select("id, title, storage_key, duration_seconds, created_at, team_id, is_private, upload_status")
      .in("id", gvIdsFull)
      .eq("team_id", teamId)
      .eq("upload_status", "ready")

    if (mode === "recruiting") {
      q = q.eq("is_private", false)
    }

    const { data: gvRows } = await q.order("created_at", { ascending: false }).limit(80)

    for (const row of gvRows ?? []) {
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
  }

  const { data: clipAttach } = await supabase
    .from("video_clip_players")
    .select("video_clip_id")
    .eq("player_id", playerId)

  const clipIds = [...new Set((clipAttach ?? []).map((r) => (r as { video_clip_id: string }).video_clip_id))]
  if (clipIds.length === 0) {
    return { braikVideos, braikClips }
  }

  let cq = supabase
    .from("video_clips")
    .select("id, title, start_ms, end_ms, game_video_id, created_at, team_id, is_private")
    .in("id", clipIds)
    .eq("team_id", teamId)

  if (mode === "recruiting") {
    cq = cq.eq("is_private", false)
  }

  const { data: clips } = await cq.order("created_at", { ascending: false }).limit(120)

  const gvIds = [...new Set((clips ?? []).map((c) => (c as { game_video_id: string }).game_video_id))]
  if (gvIds.length === 0) {
    return { braikVideos, braikClips }
  }

  let pq = supabase
    .from("game_videos")
    .select("id, title, storage_key, upload_status, is_private")
    .in("id", gvIds)
    .eq("team_id", teamId)

  if (mode === "recruiting") {
    pq = pq.eq("is_private", false).eq("upload_status", "ready")
  } else {
    pq = pq.eq("upload_status", "ready")
  }

  const { data: parents } = await pq

  const parentMap = new Map<
    string,
    { title: string | null; storage_key: string | null; ok: boolean }
  >()
  for (const p of parents ?? []) {
    const id = (p as { id: string }).id
    const uploadStatus = (p as { upload_status?: string }).upload_status
    const isPrivate = Boolean((p as { is_private?: boolean }).is_private)
    const ok =
      uploadStatus === "ready" &&
      (mode === "recruiting" ? !isPrivate : true)
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

  return { braikVideos, braikClips }
}

/**
 * Recruiter-visible Braik media: explicit player attachments only; excludes private clips/videos.
 * External links unchanged. Requires global recruiting_visibility (caller).
 */
export async function loadRecruitingFilmPayload(
  supabase: SupabaseClient,
  playerId: string,
  teamId: string | null,
): Promise<RecruitingFilmPayload> {
  const externalLinks = await loadExternalLinks(supabase, playerId)

  if (!teamId) {
    return { externalLinks, braikVideos: [], braikClips: [] }
  }

  const { braikVideos, braikClips } = await loadAttachedBraikMedia(supabase, playerId, teamId, "recruiting")
  return { externalLinks, braikVideos, braikClips }
}

/** Player/coach viewing portal: attached Braik clips/videos including items marked private for recruiting only. */
export async function loadPlayerPortalFilmPayload(
  supabase: SupabaseClient,
  playerId: string,
  teamId: string | null,
): Promise<RecruitingFilmPayload> {
  const externalLinks = await loadExternalLinks(supabase, playerId)

  if (!teamId) {
    return { externalLinks, braikVideos: [], braikClips: [] }
  }

  const { braikVideos, braikClips } = await loadAttachedBraikMedia(supabase, playerId, teamId, "player_portal")
  return { externalLinks, braikVideos, braikClips }
}
