import { NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string; sessionId: string }> }
) {
  try {
    const { teamId, sessionId } = await params
    if (!teamId || !sessionId) return NextResponse.json({ error: "Invalid" }, { status: 400 })

    const session = await requireTeamAccess(teamId)
    if (!canEditRoster(session.membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const patch: Record<string, unknown> = {}
    if (typeof body.dayOfWeek === "number" && body.dayOfWeek >= 0 && body.dayOfWeek <= 6) {
      patch.day_of_week = body.dayOfWeek
    }
    if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim()
    if ("description" in body) patch.description = typeof body.description === "string" ? body.description : null
    if (typeof body.startTime === "string") patch.start_time = body.startTime
    if (typeof body.durationMinutes === "number" && body.durationMinutes > 0) {
      patch.duration_minutes = body.durationMinutes
    }
    if (Array.isArray(body.positionGroups)) patch.position_groups = body.positionGroups

    const supabase = getSupabaseServer()
    const { data, error } = await supabase
      .from("workout_sessions")
      .update(patch)
      .eq("id", sessionId)
      .eq("team_id", teamId)
      .select("*")
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 })
    }
    return NextResponse.json({ session: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    console.error("[PATCH weight-room session]", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ teamId: string; sessionId: string }> }
) {
  try {
    const { teamId, sessionId } = await params
    if (!teamId || !sessionId) return NextResponse.json({ error: "Invalid" }, { status: 400 })

    const session = await requireTeamAccess(teamId)
    if (!canEditRoster(session.membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const supabase = getSupabaseServer()
    const { error } = await supabase.from("workout_sessions").delete().eq("id", sessionId).eq("team_id", teamId)

    if (error) return NextResponse.json({ error: "Delete failed" }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
