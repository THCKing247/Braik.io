import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramCoach } from "@/lib/auth/rbac"
import { MembershipLookupError } from "@/lib/auth/rbac"

const TEAM_LEVELS = ["varsity", "jv", "freshman"] as const

/**
 * POST /api/playbooks/assign-play
 * Assign a play to a program team level. Coaches only.
 * Body: { playId, programId, teamLevel }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as {
      playId: string
      programId: string
      teamLevel: "varsity" | "jv" | "freshman"
    }

    const { playId, programId, teamLevel } = body
    if (!playId || !programId || !teamLevel || !TEAM_LEVELS.includes(teamLevel)) {
      return NextResponse.json(
        { error: "playId, programId, and teamLevel (varsity, jv, freshman) are required" },
        { status: 400 }
      )
    }

    await requireProgramCoach(programId)

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
      console.error("[POST /api/playbooks/assign-play]", error)
      return NextResponse.json({ error: "Failed to assign play" }, { status: 500 })
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
    console.error("[POST /api/playbooks/assign-play]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
