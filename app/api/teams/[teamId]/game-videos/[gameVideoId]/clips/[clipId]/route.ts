import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import { gateGameVideoTeamApi } from "@/lib/video/api-access"
import { incrementClipRollup } from "@/lib/video/quota"

export const runtime = "nodejs"

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
