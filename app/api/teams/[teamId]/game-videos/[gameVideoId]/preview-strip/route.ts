import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import { gateGameVideoTeamApi } from "@/lib/video/api-access"
import { parseFilmPreviewManifest } from "@/lib/video/film-preview-manifest"
import { presignedGetObjectUrl } from "@/lib/video/r2-client"

export const runtime = "nodejs"

/**
 * GET — sparse preview thumbs for Film Room (presigned URLs when manifest exists).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string; gameVideoId: string }> },
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
      .select("film_preview_manifest")
      .eq("id", gameVideoId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (error || !row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const manifest = parseFilmPreviewManifest((row as { film_preview_manifest?: unknown }).film_preview_manifest)
    if (!manifest || manifest.status !== "ready" || manifest.tiles.length === 0) {
      return NextResponse.json({
        tiles: [] as Array<{ tMs: number; url: string }>,
        status: manifest?.status ?? "none",
        intervalSec: manifest?.intervalSec ?? null,
      })
    }

    const tiles: Array<{ tMs: number; url: string }> = []
    for (const t of manifest.tiles) {
      const url = await presignedGetObjectUrl(t.key)
      if (url) tiles.push({ tMs: t.tMs, url })
    }

    return NextResponse.json({
      tiles,
      status: "ready",
      intervalSec: manifest.intervalSec,
    })
  } catch (e) {
    if (e instanceof MembershipLookupError) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }
    throw e
  }
}
