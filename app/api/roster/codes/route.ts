import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * GET /api/roster/codes?teamId=xxx
 * Returns team join codes (player_code, parent_code, team_id_code).
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: team } = await supabase
      .from("teams")
      .select("id, player_code, parent_code, team_id_code")
      .eq("id", teamId)
      .maybeSingle()

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

    return NextResponse.json({
      playerCode: team.player_code || null,
      parentCode: team.parent_code || null,
      teamIdCode: team.team_id_code || null,
    })
  } catch (error: any) {
    console.error("[GET /api/roster/codes]", error)
  return NextResponse.json(
      { error: error.message || "Failed to load codes" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
  )
  }
}
