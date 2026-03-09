import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission } from "@/lib/auth/rbac"

/**
 * GET /api/roster/depth-chart?teamId=xxx
 * Returns depth chart entries for the team.
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
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

    // Get depth chart entries
    const { data: entries, error: entriesError } = await supabase
      .from("depth_chart_entries")
      .select("id, unit, position, string, player_id, formation, special_team_type")
      .eq("team_id", teamId)
      .order("unit", { ascending: true })
      .order("position", { ascending: true })
      .order("string", { ascending: true })

    if (entriesError) {
      console.error("[GET /api/roster/depth-chart]", entriesError)
      return NextResponse.json({ error: "Failed to load depth chart" }, { status: 500 })
    }

    // Get player details for entries with player_id
    const playerIds = (entries ?? []).filter((e) => e.player_id).map((e) => e.player_id!)
    let playersMap = new Map<string, { id: string; firstName: string; lastName: string; jerseyNumber: number | null; imageUrl: string | null }>()
    if (playerIds.length > 0) {
      const { data: players } = await supabase
        .from("players")
        .select("id, first_name, last_name, jersey_number, image_url")
        .in("id", playerIds)

      playersMap = new Map(
        (players ?? []).map((p) => [
          p.id,
          {
            id: p.id,
            firstName: p.first_name,
            lastName: p.last_name,
            jerseyNumber: p.jersey_number,
            imageUrl: p.image_url,
          },
        ])
      )
    }

    // Format response
    const formatted = (entries ?? []).map((e) => ({
      id: e.id,
      unit: e.unit,
      position: e.position,
      string: e.string,
      playerId: e.player_id,
      player: e.player_id ? playersMap.get(e.player_id) || null : null,
      formation: e.formation || null,
      specialTeamType: e.special_team_type || null,
    }))

    return NextResponse.json({ entries: formatted })
  } catch (error: any) {
    console.error("[GET /api/roster/depth-chart]", error)
    return NextResponse.json(
      { error: error.message || "Failed to load depth chart" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * POST /api/roster/depth-chart?teamId=xxx
 * Updates depth chart entries (supports POST for compatibility).
 */
export async function POST(request: Request) {
  return PATCH(request)
}

/**
 * PATCH /api/roster/depth-chart?teamId=xxx
 * Updates depth chart entries.
 */
export async function PATCH(request: Request) {
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

    await requireTeamPermission(teamId, "edit_roster")

    const body = (await request.json()) as {
      entries?: Array<{
        unit: string
        position: string
        string: number
        playerId: string | null
        formation?: string | null
        specialTeamType?: string | null
      }>
      updates?: Array<{
        unit: string
        position: string
        string: number
        playerId: string | null
        formation?: string | null
        specialTeamType?: string | null
      }>
    }

    const updates = body.entries || body.updates || []

    if (updates.length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    // Delete existing entries for the positions being updated
    const positionsToUpdate = updates.map((u) => ({ unit: u.unit, position: u.position }))
    const uniquePositions = Array.from(new Set(positionsToUpdate.map((p) => `${p.unit}:${p.position}`)))

    for (const posKey of uniquePositions) {
      const [unit, position] = posKey.split(":")
      await supabase
        .from("depth_chart_entries")
        .delete()
        .eq("team_id", teamId)
        .eq("unit", unit)
        .eq("position", position)
    }

    // Insert new entries
    const entriesToInsert = updates.map((u) => ({
      team_id: teamId,
      unit: u.unit,
      position: u.position,
      string: u.string,
      player_id: u.playerId || null,
      formation: u.formation || null,
      special_team_type: u.specialTeamType || null,
    }))

    const { error: insertError } = await supabase.from("depth_chart_entries").insert(entriesToInsert)

    if (insertError) {
      console.error("[PATCH /api/roster/depth-chart]", insertError)
      return NextResponse.json({ error: "Failed to update depth chart" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[PATCH /api/roster/depth-chart]", error)
    return NextResponse.json(
      { error: error.message || "Failed to update depth chart" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
