import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import { gateGameVideoTeamApi } from "@/lib/video/api-access"

export const runtime = "nodejs"

/**
 * POST — reserved for future server-side FFmpeg strip generation (long-running workers).
 * Returns 501 unless a self-hosted worker sets FFMPEG_BIN and implements extraction.
 * Does not run on typical serverless timeouts; use a job queue in production.
 */
export async function POST(
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

    const { data: row } = await supabase
      .from("game_videos")
      .select("id, storage_key, team_id")
      .eq("id", gameVideoId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const ffmpegBin = process.env.FFMPEG_BIN?.trim()
    if (!ffmpegBin) {
      return NextResponse.json({
        ok: false,
        skipped: true,
        reason:
          "Server-side preview generation is not configured (set FFMPEG_BIN and a worker). The Film Room builds a session preview from the browser when you open the film.",
      })
    }

    return NextResponse.json({
      ok: false,
      skipped: true,
      reason: "FFmpeg path is set but automated strip generation is not wired in this deployment. Use client preview or a dedicated worker.",
    })
  } catch (e) {
    if (e instanceof MembershipLookupError) {
      return NextResponse.json({ error: e.message }, { status: 403 })
    }
    throw e
  }
}
