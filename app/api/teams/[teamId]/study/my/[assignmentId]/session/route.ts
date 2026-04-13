import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { recomputeStudyPlayerRow } from "@/lib/study-player-sync"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

const MAX_DWELL_DELTA = 120

/** POST — engagement + material open signals (no quiz answers). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string; assignmentId: string }> }
) {
  try {
    const { teamId, assignmentId } = await params
    if (!teamId || !assignmentId) return NextResponse.json({ error: "Bad request" }, { status: 400 })

    const session = await getServerSession()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { membership } = await requireTeamAccess(teamId)
    if (canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Players only" }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      dwellDeltaSec?: number
      materialLinkOpened?: boolean
    }

    const supabase = getSupabaseServer()
    const { data: player } = await supabase
      .from("players")
      .select("id")
      .eq("team_id", teamId)
      .eq("user_id", session.user.id)
      .maybeSingle()

    if (!player) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data: a } = await supabase
      .from("study_assignments")
      .select("publish_status")
      .eq("id", assignmentId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (!a || a.publish_status !== "published") return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data: sap } = await supabase
      .from("study_assignment_players")
      .select(
        "time_spent_seconds, opened_at, review_started_at, last_activity_at, review_material_opened_at, status"
      )
      .eq("assignment_id", assignmentId)
      .eq("player_id", player.id)
      .maybeSingle()

    if (!sap) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const now = new Date().toISOString()
    const delta = Math.min(MAX_DWELL_DELTA, Math.max(0, Math.floor(Number(body.dwellDeltaSec) || 0)))
    const nextSeconds = Math.min(86400, (sap.time_spent_seconds as number) + delta)

    const patch: Record<string, unknown> = {
      time_spent_seconds: nextSeconds,
      last_activity_at: now,
    }

    if (!sap.opened_at) {
      patch.opened_at = now
      patch.review_started_at = now
      patch.status = "in_progress"
    } else if (sap.status === "not_started") {
      patch.status = "in_progress"
    }

    if (body.materialLinkOpened) {
      patch.review_material_opened_at = sap.review_material_opened_at ?? now
    }

    await supabase.from("study_assignment_players").update(patch).eq("assignment_id", assignmentId).eq("player_id", player.id)

    await recomputeStudyPlayerRow(supabase, assignmentId, player.id)

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
