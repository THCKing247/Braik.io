/**
 * DELETE /api/stats/season
 * Body: { teamId, playerIds: string[] }
 * Clears players.season_stats for the given roster players (coach/edit_roster only).
 */
import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission, MembershipLookupError } from "@/lib/auth/rbac"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Body = { teamId?: string; playerIds?: string[] }

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as Body | null
    const teamId = body?.teamId?.trim()
    const playerIds = body?.playerIds?.filter((x) => typeof x === "string" && UUID_REGEX.test(x)) ?? []
    if (!teamId || playerIds.length === 0) {
      return NextResponse.json({ error: "teamId and playerIds are required" }, { status: 400 })
    }
    if (playerIds.length > 500) {
      return NextResponse.json({ error: "Too many players" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    const { data: updated, error } = await supabase
      .from("players")
      .update({ season_stats: {} })
      .eq("team_id", teamId)
      .in("id", playerIds)
      .select("id")

    if (error) {
      console.error("[DELETE /api/stats/season]", error)
      return NextResponse.json({ error: "Failed to clear season stats" }, { status: 500 })
    }

    return NextResponse.json({ success: true, cleared: (updated ?? []).length })
  } catch (err) {
    if (err instanceof MembershipLookupError) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    const msg = err instanceof Error ? err.message : "Failed"
    if (msg.includes("Access denied") || msg.includes("Insufficient permissions")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }
    console.error("[DELETE /api/stats/season]", err)
    return NextResponse.json({ error: "Failed to clear season stats" }, { status: 500 })
  }
}
