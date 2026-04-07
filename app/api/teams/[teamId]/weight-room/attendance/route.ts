import { NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

/**
 * GET /api/teams/[teamId]/weight-room/attendance?sessionId=&attendanceDate=
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })

    const { membership } = await requireTeamAccess(teamId)
    if (!canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const url = new URL(request.url)
    const sessionId = url.searchParams.get("sessionId")
    const attendanceDate = url.searchParams.get("attendanceDate")
    if (!sessionId || !attendanceDate) {
      return NextResponse.json({ error: "sessionId and attendanceDate required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data, error } = await supabase
      .from("workout_attendance")
      .select("player_id, status")
      .eq("session_id", sessionId)
      .eq("attendance_date", attendanceDate)

    if (error) return NextResponse.json({ error: "Failed" }, { status: 500 })
    return NextResponse.json({ records: data ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

/**
 * POST /api/teams/[teamId]/weight-room/attendance
 * Body: { sessionId, attendanceDate (YYYY-MM-DD), records: { playerId: 'present'|'absent' }[] }
 */
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
      sessionId?: string
      attendanceDate?: string
      records?: { playerId: string; status: "present" | "absent" }[]
    }

    if (!body.sessionId || !body.attendanceDate) {
      return NextResponse.json({ error: "sessionId and attendanceDate required" }, { status: 400 })
    }
    if (!Array.isArray(body.records) || body.records.length === 0) {
      return NextResponse.json({ error: "records required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: ws } = await supabase
      .from("workout_sessions")
      .select("id")
      .eq("id", body.sessionId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (!ws) return NextResponse.json({ error: "Session not found" }, { status: 404 })

    const rows = body.records.map((r) => ({
      session_id: body.sessionId,
      player_id: r.playerId,
      status: r.status,
      attendance_date: body.attendanceDate,
    }))

    await supabase
      .from("workout_attendance")
      .delete()
      .eq("session_id", body.sessionId)
      .eq("attendance_date", body.attendanceDate)

    const { error } = await supabase.from("workout_attendance").insert(rows)

    if (error) {
      console.error("[weight-room attendance]", error)
      return NextResponse.json({ error: "Failed to save attendance" }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    console.error("[weight-room attendance]", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
