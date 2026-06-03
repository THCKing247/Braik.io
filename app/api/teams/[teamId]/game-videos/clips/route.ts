import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import { gateGameVideoTeamApi } from "@/lib/video/api-access"
import { fetchAttachedPlayerIdsForClips } from "@/lib/video/player-media-attachments"

const LIBRARY_CLIP_SELECT =
  "id, game_video_id, start_ms, end_ms, duration_ms, title, label, description, tags, share_token, metadata, created_at, updated_at, is_private"

/** Max clips returned for library browse (100 films × 200 clips per film cap). */
const TEAM_CLIPS_LIBRARY_LIMIT = 20_000

/**
 * List clips for all game videos on a team (library browse).
 * Per-video GET remains for film-room detail.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId required" }, { status: 400 })
    }

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
      .select(LIBRARY_CLIP_SELECT)
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(TEAM_CLIPS_LIBRARY_LIMIT)

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

export const runtime = "nodejs"
