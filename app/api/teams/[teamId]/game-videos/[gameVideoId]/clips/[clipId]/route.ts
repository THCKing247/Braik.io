import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import { gateGameVideoTeamApi } from "@/lib/video/api-access"
import { incrementClipRollup } from "@/lib/video/quota"

export const runtime = "nodejs"

/**
 * PATCH — recruiting privacy and/or clip marks & metadata.
 * Privacy-only: { isPrivate: boolean }
 * Clip edit: { startMs?, endMs?, title?, description?, tags?, categories? } (requires createClip)
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string; gameVideoId: string; clipId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, gameVideoId, clipId } = await params
    await requireTeamAccess(teamId)

    const supabase = getSupabaseServer()

    let body: {
      isPrivate?: boolean
      startMs?: number
      endMs?: number
      title?: string
      description?: string | null
      tags?: string[]
      categories?: Record<string, string>
    }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const keys = Object.keys(body).filter((k) => body[k as keyof typeof body] !== undefined)
    const privacyOnly =
      keys.length === 1 && keys[0] === "isPrivate" && typeof body.isPrivate === "boolean"

    const editsMarksOrMeta =
      typeof body.startMs === "number" ||
      typeof body.endMs === "number" ||
      typeof body.title === "string" ||
      body.description !== undefined ||
      Array.isArray(body.tags) ||
      (body.categories && typeof body.categories === "object")

    if (!privacyOnly && !editsMarksOrMeta) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
    }

    if (privacyOnly) {
      const gate = await gateGameVideoTeamApi(supabase, session.user.id, teamId, { view: true }, {
        portalRole: session.user.role,
        isPlatformOwner: session.user.isPlatformOwner === true,
      })
      if (!gate.ok) {
        return NextResponse.json({ error: gate.message }, { status: gate.status })
      }

      const { data: updated, error } = await supabase
        .from("video_clips")
        .update({ is_private: body.isPrivate, updated_at: new Date().toISOString() })
        .eq("id", clipId)
        .eq("team_id", teamId)
        .eq("game_video_id", gameVideoId)
        .select("id, is_private")
        .maybeSingle()

      if (error || !updated) {
        return NextResponse.json({ error: "Not found or update failed" }, { status: 404 })
      }

      return NextResponse.json({ clip: updated })
    }

    const gate = await gateGameVideoTeamApi(supabase, session.user.id, teamId, { createClip: true, view: true }, {
      portalRole: session.user.role,
      isPlatformOwner: session.user.isPlatformOwner === true,
    })
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: gate.status })
    }

    const { data: existing, error: loadErr } = await supabase
      .from("video_clips")
      .select("id, start_ms, end_ms, title, label, description, tags, metadata")
      .eq("id", clipId)
      .eq("team_id", teamId)
      .eq("game_video_id", gameVideoId)
      .maybeSingle()

    if (loadErr || !existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const ex = existing as {
      start_ms: number
      end_ms: number
      title?: string | null
      label?: string | null
      description?: string | null
      tags?: string[] | null
      metadata?: { categories?: Record<string, string> } | null
    }

    let startMs = ex.start_ms
    let endMs = ex.end_ms
    if (typeof body.startMs === "number" && Number.isFinite(body.startMs)) startMs = Math.floor(body.startMs)
    if (typeof body.endMs === "number" && Number.isFinite(body.endMs)) endMs = Math.floor(body.endMs)
    if (endMs <= startMs + 80) {
      return NextResponse.json({ error: "endMs must be after startMs" }, { status: 400 })
    }

    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : (ex.title ?? ex.label ?? "Clip")
    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : body.description === null
          ? null
          : ex.description ?? null
    const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 24) : ex.tags ?? []

    const prevMeta = ex.metadata?.categories ?? {}
    const rawCats = body.categories && typeof body.categories === "object" ? body.categories : {}
    const categories: Record<string, string> = { ...prevMeta }
    for (const [k, v] of Object.entries(rawCats)) {
      const key = String(k).trim().slice(0, 40)
      const val = String(v ?? "").trim().slice(0, 120)
      if (key && val) categories[key] = val
    }

    const durationMs = endMs - startMs
    const metadata =
      Object.keys(categories).length > 0 ? { ...((ex.metadata as object) ?? {}), categories } : ex.metadata ?? {}

    const { data: updated, error: upErr } = await supabase
      .from("video_clips")
      .update({
        start_ms: startMs,
        end_ms: endMs,
        duration_ms: durationMs,
        title,
        label: title,
        description,
        tags,
        metadata,
        ...(typeof body.isPrivate === "boolean" ? { is_private: body.isPrivate } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", clipId)
      .eq("team_id", teamId)
      .eq("game_video_id", gameVideoId)
      .select(
        "id, game_video_id, start_ms, end_ms, duration_ms, title, label, description, tags, share_token, metadata, created_at, updated_at, is_private"
      )
      .maybeSingle()

    if (upErr || !updated) {
      return NextResponse.json({ error: upErr?.message || "Update failed" }, { status: 500 })
    }

    return NextResponse.json({ clip: updated })
  } catch (e) {
    if (e instanceof MembershipLookupError) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }
    throw e
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ teamId: string; gameVideoId: string; clipId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId, gameVideoId, clipId } = await params
    await requireTeamAccess(teamId)

    const supabase = getSupabaseServer()
    const gate = await gateGameVideoTeamApi(supabase, session.user.id, teamId, { createClip: true, view: true }, {
      portalRole: session.user.role,
      isPlatformOwner: session.user.isPlatformOwner === true,
    })
    if (!gate.ok) {
      return NextResponse.json({ error: gate.message }, { status: gate.status })
    }

    const { data: clip, error: loadErr } = await supabase
      .from("video_clips")
      .select("id")
      .eq("id", clipId)
      .eq("team_id", teamId)
      .eq("game_video_id", gameVideoId)
      .maybeSingle()

    if (loadErr || !clip) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { error: delErr } = await supabase
      .from("video_clips")
      .delete()
      .eq("id", clipId)
      .eq("team_id", teamId)
      .eq("game_video_id", gameVideoId)

    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    await incrementClipRollup(supabase, teamId, -1)

    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof MembershipLookupError) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }
    throw e
  }
}
