import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import { gateGameVideoTeamApi } from "@/lib/video/api-access"

/**
 * Lists game videos for a team.
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
      .from("game_videos")
      .select(
        "id, team_id, title, mime_type, file_size_bytes, duration_seconds, upload_status, processing_status, created_at, is_private"
      )
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ videos: rows ?? [] })
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
