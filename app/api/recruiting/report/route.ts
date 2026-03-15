import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireProgramCoach } from "@/lib/auth/rbac"
import { MembershipLookupError } from "@/lib/auth/rbac"
import { getRecruitingReport } from "@/lib/recruiting/report"

/**
 * GET /api/recruiting/report?playerId=xxx
 * Returns full recruiting report for a player. Coach must belong to the player's program.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const playerId = searchParams.get("playerId")
    if (!playerId) {
      return NextResponse.json({ error: "playerId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: player } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("id", playerId)
      .maybeSingle()

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 })
    }

    const { data: team } = await supabase
      .from("teams")
      .select("program_id")
      .eq("id", (player as { team_id: string }).team_id)
      .maybeSingle()

    const programId = team ? (team as { program_id?: string }).program_id : null
    if (!programId) {
      return NextResponse.json({ error: "Player is not in a program" }, { status: 400 })
    }

    await requireProgramCoach(programId)

    const report = await getRecruitingReport(supabase, playerId)
    if (!report) {
      return NextResponse.json({ error: "Report could not be generated" }, { status: 500 })
    }
    return NextResponse.json(report)
  } catch (err: unknown) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/recruiting/report]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
