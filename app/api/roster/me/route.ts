import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * GET /api/roster/me?teamId=xxx
 * Returns the current user's player record id for the given team (when they have claimed a roster spot).
 * Used by Player Portal to resolve "My Profile" -> /dashboard/roster/[playerId].
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

    await requireTeamAccess(teamId)

    const supabase = getSupabaseServer()
    const { data: player, error } = await supabase
      .from("players")
      .select("id, team_id")
      .eq("team_id", teamId)
      .eq("user_id", session.user.id)
      .maybeSingle()

    if (error) {
      console.error("[GET /api/roster/me]", error.message)
      return NextResponse.json({ error: "Failed to lookup player" }, { status: 500 })
    }

    if (!player) {
      return NextResponse.json({ playerId: null, teamId }, { status: 200 })
    }

    return NextResponse.json({
      playerId: player.id,
      teamId: player.team_id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json(
        { error: "You don't have access to this team." },
        { status: 403 }
      )
    }
    console.error("[GET /api/roster/me]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
