import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import { gateGameVideoTeamApi } from "@/lib/video/api-access"
import { resolveEffectiveVideoEntitlements } from "@/lib/video/entitlements"
import { incrementClipRollup } from "@/lib/video/quota"
import { fetchAttachedPlayerIdsForClips, replaceVideoClipPlayers } from "@/lib/video/player-media-attachments"

/**
 * List and create clips for a game video.
 */
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

    const { data: rows, error } = await supabase
      .from("video_clips")
      .select(
        "id, game_video_id, start_ms, end_ms, duration_ms, title, label, description, tags, share_token, metadata, created_at, updated_at, is_private"
      )
      .eq("team_id", teamId)
      .eq("game_video_id", gameVideoId)
      .order("created_at", { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const list = rows ?? []
    const attachMap = await fetchAttachedPlayerIdsForClips(
      supabase,
      list.map((r) => (r as { id: string }).id),
    )
    const clips = list.map((r) => ({
      ...(r as object),
      attachedPlayerIds: attachMap.get((r as { id: string }).id) ?? [],
    }))

    return NextResponse.json({ clips })
  } catch (e) {
    if (e instanceof MembershipLookupError) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }
    const msg = e instanceof Error ? e.message : "Forbidden"
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    throw e
  }
}

export async function POST(
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
    const gate = await gateGameVideoTeamApi(supabase, session.user.id, teamId, { createClip: true, view: true }, {
      portalRole: session.user.role,
      isPlatformOwner: session.user.isPlatformOwner === true,
    })
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: gate.status })
    }

    let body: {
      startMs?: number
      endMs?: number
      title?: string
      description?: string | null
      tags?: string[]
      categories?: Record<string, string>
      playerIds?: string[]
    }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const startMs = Math.floor(Number(body.startMs))
    const endMs = Math.floor(Number(body.endMs))
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      return NextResponse.json({ error: "Valid startMs and endMs (end > start) are required" }, { status: 400 })
    }

    const ent = await resolveEffectiveVideoEntitlements(supabase, teamId)
    if (!ent) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    if (ent.maxClips != null) {
      const { count, error: cErr } = await supabase
        .from("video_clips")
        .select("id", { count: "exact", head: true })
        .eq("team_id", teamId)
      if (!cErr && count != null && count >= ent.maxClips) {
        return NextResponse.json(
          { error: "Maximum clip count reached for this team’s video entitlement.", code: "CLIP_CAP" },
          { status: 409 }
        )
      }
    }

    const { data: gv } = await supabase
      .from("game_videos")
      .select("id")
      .eq("id", gameVideoId)
      .eq("team_id", teamId)
      .maybeSingle()
    if (!gv) {
      return NextResponse.json({ error: "Game video not found" }, { status: 404 })
    }

    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Clip"
    const description =
      typeof body.description === "string" && body.description.trim() ? body.description.trim() : null
    const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 24) : []

    if (ent.taggingEnabled === false && tags.length > 0) {
      return NextResponse.json({ error: "Tagging is not enabled for this team." }, { status: 403 })
    }

    const durationMs = endMs - startMs

    const rawCats = body.categories && typeof body.categories === "object" ? body.categories : {}
    const categories: Record<string, string> = {}
    for (const [k, v] of Object.entries(rawCats)) {
      const key = String(k).trim().slice(0, 40)
      const val = String(v ?? "").trim().slice(0, 120)
      if (key && val) categories[key] = val
    }

    const { data: inserted, error: insErr } = await supabase
      .from("video_clips")
      .insert({
        game_video_id: gameVideoId,
        team_id: teamId,
        created_by: session.user.id,
        start_ms: startMs,
        end_ms: endMs,
        duration_ms: durationMs,
        title,
        label: title,
        description,
        tags,
        metadata: Object.keys(categories).length > 0 ? { categories } : {},
        updated_at: new Date().toISOString(),
      })
      .select("id, game_video_id, start_ms, end_ms, duration_ms, title, description, tags, share_token, created_at")
      .maybeSingle()

    if (insErr || !inserted) {
      console.error("[clips POST]", insErr?.message)
      return NextResponse.json({ error: "Failed to create clip" }, { status: 500 })
    }

    await incrementClipRollup(supabase, teamId, 1)

    let attachedPlayerIds: string[] = []
    if (body.playerIds !== undefined) {
      try {
        const rep = await replaceVideoClipPlayers(supabase, inserted.id, teamId, body.playerIds)
        attachedPlayerIds = rep.playerIds
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid player attachment"
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    }

    return NextResponse.json({ clip: { ...inserted, attachedPlayerIds } })
  } catch (e) {
    if (e instanceof MembershipLookupError) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }
    throw e
  }
}

export const runtime = "nodejs"
