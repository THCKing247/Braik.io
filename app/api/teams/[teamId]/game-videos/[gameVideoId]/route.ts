import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import { gateGameVideoTeamApi } from "@/lib/video/api-access"
import { deleteObjectFromR2, presignedGetObjectUrl } from "@/lib/video/r2-client"
import { adjustRollupAfterVideoDelete } from "@/lib/video/quota"
import { fetchAttachedPlayerIdsForGameVideo, replaceGameVideoPlayers } from "@/lib/video/player-media-attachments"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string; gameVideoId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, gameVideoId } = await params
    await requireTeamAccess(teamId)

    const supabase = getSupabaseServer()
    const gate = await gateGameVideoTeamApi(supabase, session.user.id, teamId, { view: true }, {
      portalRole: session.user.role,
      isPlatformOwner: session.user.isPlatformOwner === true,
    })
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: gate.status })
    }

    const { data: row, error } = await supabase
      .from("game_videos")
      .select(
        "id, team_id, title, storage_key, mime_type, file_size_bytes, duration_seconds, upload_status, processing_status, thumbnail_key, transcript_status, created_at, updated_at"
      )
      .eq("id", gameVideoId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (error || !row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const key = (row as { storage_key?: string | null }).storage_key
    const attachedPlayerIds = await fetchAttachedPlayerIdsForGameVideo(supabase, gameVideoId)

    if ((row as { upload_status?: string }).upload_status !== "ready" || !key) {
      return NextResponse.json({ video: row, playbackUrl: null, attachedPlayerIds })
    }

    const playbackUrl = await presignedGetObjectUrl(key)
    return NextResponse.json({ video: row, playbackUrl, playbackExpiresSeconds: 3600, attachedPlayerIds })
  } catch (e) {
    if (e instanceof MembershipLookupError) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }
    throw e
  }
}

/**
 * PATCH — recruiting privacy and/or roster attachments for full film.
 * Body: { isPrivate?: boolean; playerIds?: string[] }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string; gameVideoId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, gameVideoId } = await params
    await requireTeamAccess(teamId)

    const supabase = getSupabaseServer()

    let body: { isPrivate?: boolean; playerIds?: string[] }
    try {
      body = (await request.json()) as { isPrivate?: boolean; playerIds?: string[] }
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    if (typeof body.isPrivate !== "boolean" && body.playerIds === undefined) {
      return NextResponse.json({ error: "isPrivate and/or playerIds required" }, { status: 400 })
    }

    const { data: gvExists } = await supabase
      .from("game_videos")
      .select("id")
      .eq("id", gameVideoId)
      .eq("team_id", teamId)
      .maybeSingle()
    if (!gvExists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const gate = await gateGameVideoTeamApi(
      supabase,
      session.user.id,
      teamId,
      { view: true, createClip: body.playerIds !== undefined },
      {
        portalRole: session.user.role,
        isPlatformOwner: session.user.isPlatformOwner === true,
      },
    )
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: gate.status })
    }

    if (typeof body.isPrivate === "boolean") {
      const { data: privRow, error: upErr } = await supabase
        .from("game_videos")
        .update({ is_private: body.isPrivate, updated_at: new Date().toISOString() })
        .eq("id", gameVideoId)
        .eq("team_id", teamId)
        .select("id")
        .maybeSingle()

      if (upErr || !privRow) {
        return NextResponse.json({ error: "Not found or update failed" }, { status: 404 })
      }
    }

    if (body.playerIds !== undefined) {
      try {
        await replaceGameVideoPlayers(supabase, gameVideoId, teamId, body.playerIds)
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid player attachment"
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    }

    const { data: updated } = await supabase
      .from("game_videos")
      .select("id, is_private")
      .eq("id", gameVideoId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const attachedPlayerIds = await fetchAttachedPlayerIdsForGameVideo(supabase, gameVideoId)

    return NextResponse.json({ video: { ...updated, attachedPlayerIds } })
  } catch (e) {
    if (e instanceof MembershipLookupError) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }
    throw e
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ teamId: string; gameVideoId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, gameVideoId } = await params
    await requireTeamAccess(teamId)

    const supabase = getSupabaseServer()
    const gate = await gateGameVideoTeamApi(supabase, session.user.id, teamId, { deleteVideo: true, view: true }, {
      portalRole: session.user.role,
      isPlatformOwner: session.user.isPlatformOwner === true,
    })
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: gate.status })
    }

    const { data: row, error } = await supabase
      .from("game_videos")
      .select("id, storage_key, thumbnail_key, file_size_bytes, upload_status")
      .eq("id", gameVideoId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (error || !row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const key = (row as { storage_key?: string | null }).storage_key
    const sz = Number((row as { file_size_bytes?: number }).file_size_bytes ?? 0)

    if (key) {
      await deleteObjectFromR2(key)
      const thumb = (row as { thumbnail_key?: string | null }).thumbnail_key
      if (thumb) await deleteObjectFromR2(thumb).catch(() => undefined)
    }

    const { error: delErr } = await supabase.from("game_videos").delete().eq("id", gameVideoId).eq("team_id", teamId)
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    if ((row as { upload_status?: string }).upload_status === "ready" && sz > 0) {
      await adjustRollupAfterVideoDelete(supabase, teamId, sz)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof MembershipLookupError) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }
    throw e
  }
}
