import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramCoach } from "@/lib/auth/rbac"
import { MembershipLookupError } from "@/lib/auth/rbac"

const TEAM_LEVELS = ["varsity", "jv", "freshman"] as const

/**
 * GET /api/programs/[programId]/play-assignments?teamLevel=xxx
 * List play assignments for the program. Optional teamLevel filter.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const { programId } = await params
    if (!programId) {
      return NextResponse.json({ error: "programId is required" }, { status: 400 })
    }

    await requireProgramCoach(programId)

    const { searchParams } = new URL(request.url)
    const teamLevel = searchParams.get("teamLevel")

    const supabase = getSupabaseServer()
    let query = supabase
      .from("play_assignments")
      .select("id, play_id, program_id, team_level, created_by_user_id, created_at")
      .eq("program_id", programId)
      .order("created_at", { ascending: false })

    if (teamLevel && TEAM_LEVELS.includes(teamLevel as (typeof TEAM_LEVELS)[number])) {
      query = query.eq("team_level", teamLevel)
    }

    const { data, error } = await query

    if (error) {
      console.error("[GET /api/programs/[programId]/play-assignments]", error)
      return NextResponse.json({ error: "Failed to load play assignments" }, { status: 500 })
    }

    const assignments = (data ?? []).map((a) => ({
      id: a.id,
      playId: a.play_id,
      programId: a.program_id,
      teamLevel: a.team_level,
      createdByUserId: a.created_by_user_id,
      createdAt: a.created_at,
    }))

    return NextResponse.json({ assignments })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/programs/[programId]/play-assignments]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/programs/[programId]/play-assignments
 * Assign a play to a program team level. Coaches only.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ programId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { programId } = await params
    if (!programId) {
      return NextResponse.json({ error: "programId is required" }, { status: 400 })
    }

    await requireProgramCoach(programId)

    const body = (await request.json()) as {
      playId: string
      teamLevel: "varsity" | "jv" | "freshman"
    }

    const { playId, teamLevel } = body
    if (!playId || !teamLevel || !TEAM_LEVELS.includes(teamLevel)) {
      return NextResponse.json(
        { error: "playId and teamLevel (varsity, jv, freshman) are required" },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()

    const { data: play } = await supabase
      .from("plays")
      .select("id, team_id")
      .eq("id", playId)
      .maybeSingle()

    if (!play) {
      return NextResponse.json({ error: "Play not found" }, { status: 404 })
    }

    const { data: team } = await supabase
      .from("teams")
      .select("program_id")
      .eq("id", (play as { team_id: string }).team_id)
      .maybeSingle()

    if (!team || (team as { program_id?: string }).program_id !== programId) {
      return NextResponse.json({ error: "Play is not in this program" }, { status: 400 })
    }

    const { data: row, error } = await supabase
      .from("play_assignments")
      .upsert(
        {
          play_id: playId,
          program_id: programId,
          team_level: teamLevel,
          created_by_user_id: session.user.id,
        },
        { onConflict: "play_id,program_id,team_level" }
      )
      .select("id, play_id, program_id, team_level, created_at")
      .single()

    if (error) {
      console.error("[POST /api/programs/[programId]/play-assignments]", error)
      return NextResponse.json({ error: "Failed to create play assignment" }, { status: 500 })
    }

    return NextResponse.json({
      id: row.id,
      playId: row.play_id,
      programId: row.program_id,
      teamLevel: row.team_level,
      createdAt: row.created_at,
    })
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST /api/programs/[programId]/play-assignments]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
