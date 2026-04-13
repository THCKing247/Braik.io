import { NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

/**
 * GET /api/teams/[teamId]/weight-room/schedule
 * POST — create workout session block
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })

    await requireTeamAccess(teamId)

    const supabase = getSupabaseServer()
    const { data, error } = await supabase
      .from("workout_sessions")
      .select("*")
      .eq("team_id", teamId)
      .order("day_of_week")
      .order("start_time")

    if (error) {
      console.error("[weight-room schedule GET]", error)
      return NextResponse.json({ error: "Failed to load schedule" }, { status: 500 })
    }

    return NextResponse.json({ sessions: data ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[weight-room schedule GET]", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })

    const session = await requireTeamAccess(teamId)
    if (!canEditRoster(session.membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const body = (await request.json()) as {
      dayOfWeek?: number
      title?: string
      description?: string | null
      startTime?: string
      durationMinutes?: number
      positionGroups?: string[]
      workoutItems?: { lift?: string; reps?: string }[]
    }

    const dayOfWeek = Number(body.dayOfWeek)
    if (!Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({ error: "dayOfWeek 0–6 required" }, { status: 400 })
    }
    if (!body.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 })
    if (!body.startTime?.trim()) return NextResponse.json({ error: "startTime required" }, { status: 400 })
    const dur = Number(body.durationMinutes)
    if (!Number.isFinite(dur) || dur < 1) return NextResponse.json({ error: "durationMinutes required" }, { status: 400 })

    const workoutItems = Array.isArray(body.workoutItems)
      ? body.workoutItems
          .map((r) => ({
            lift: typeof r?.lift === "string" ? r.lift.trim() : "",
            reps: typeof r?.reps === "string" ? r.reps.trim() : "",
          }))
          .filter((r) => r.lift.length > 0 || r.reps.length > 0)
      : []

    const supabase = getSupabaseServer()
    const { data, error } = await supabase
      .from("workout_sessions")
      .insert({
        team_id: teamId,
        day_of_week: dayOfWeek,
        title: body.title.trim(),
        description:
          workoutItems.length > 0 ? null : typeof body.description === "string" ? body.description.trim() || null : null,
        workout_items: workoutItems,
        start_time: body.startTime,
        duration_minutes: dur,
        position_groups: Array.isArray(body.positionGroups) ? body.positionGroups : [],
        created_by: session.user.id,
      })
      .select("*")
      .single()

    if (error) {
      console.error("[weight-room schedule POST]", error)
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
    }

    return NextResponse.json({ session: data })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied") || msg.includes("Not a member")) {
      return NextResponse.json({ error: msg }, { status: 403 })
    }
    console.error("[weight-room schedule POST]", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
