import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, MembershipLookupError } from "@/lib/auth/rbac"
import {
  effectiveVideoClipsProductEnabled,
  loadTeamOrgVideoFlags,
  loadUserVideoPermissions,
} from "@/lib/video/resolve-video-clips-access"

/**
 * Lists game videos for a team. TODO: enforce storage paths, signed URLs, and upload pipeline.
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
    const [flags, perms] = await Promise.all([
      loadTeamOrgVideoFlags(supabase, teamId),
      loadUserVideoPermissions(supabase, session.user.id),
    ])

    const productEnabled = effectiveVideoClipsProductEnabled({
      teamVideoClipsEnabled: flags.teamVideoClipsEnabled,
      organizationVideoClipsEnabled: flags.organizationVideoClipsEnabled,
    })
    if (!productEnabled || !perms.can_view_video) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: rows, error } = await supabase
      .from("game_videos")
      .select("id, team_id, title, duration_seconds, created_at")
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
