import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission } from "@/lib/auth/rbac"

/**
 * GET /api/plays?teamId=xxx&side=xxx
 * Returns plays for the team, optionally filtered by side.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const side = searchParams.get("side")

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

    let query = supabase
      .from("plays")
      .select("id, team_id, playbook_id, side, formation, subcategory, name, canvas_data, created_at, updated_at")
      .eq("team_id", teamId)

    if (side) {
      query = query.eq("side", side)
    }

    const { data: plays, error: playsError } = await query.order("formation", { ascending: true }).order("name", { ascending: true })

    if (playsError) {
      console.error("[GET /api/plays]", playsError)
      return NextResponse.json({ error: "Failed to load plays" }, { status: 500 })
    }

    // Format response
    const formatted = (plays ?? []).map((p) => ({
      id: p.id,
      teamId: p.team_id,
      playbookId: p.playbook_id || null,
      side: p.side,
      formation: p.formation,
      subcategory: p.subcategory || null,
      name: p.name,
      canvasData: p.canvas_data,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }))

    return NextResponse.json(formatted)
  } catch (error: any) {
    console.error("[GET /api/plays]", error)
    return NextResponse.json(
      { error: error.message || "Failed to load plays" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * POST /api/plays
 * Creates a new play.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as {
      teamId?: string
      playbookId?: string | null
      side?: string
      formation?: string
      subcategory?: string | null
      name?: string
      canvasData?: any
    }

    const { teamId, playbookId, side, formation, subcategory, name, canvasData } = body

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    if (!side || !["offense", "defense", "special_teams"].includes(side)) {
      return NextResponse.json({ error: "side must be offense, defense, or special_teams" }, { status: 400 })
    }

    if (!formation || !formation.trim()) {
      return NextResponse.json({ error: "formation is required" }, { status: 400 })
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    // Check permissions based on side
    if (side === "offense") {
      await requireTeamPermission(teamId, "edit_offense_plays")
    } else if (side === "defense") {
      await requireTeamPermission(teamId, "edit_defense_plays")
    } else {
      await requireTeamPermission(teamId, "edit_special_teams_plays")
    }

    const supabase = getSupabaseServer()

    // Verify team exists
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Verify playbook exists if provided
    if (playbookId) {
      const { data: playbook } = await supabase
        .from("playbooks")
        .select("id")
        .eq("id", playbookId)
        .eq("team_id", teamId)
        .maybeSingle()
      if (!playbook) {
        return NextResponse.json({ error: "Playbook not found" }, { status: 404 })
      }
    }

    // Create play
    const { data: play, error: playError } = await supabase
      .from("plays")
      .insert({
        team_id: teamId,
        playbook_id: playbookId || null,
        side,
        formation: formation.trim(),
        subcategory: subcategory?.trim() || null,
        name: name.trim(),
        canvas_data: canvasData || null,
      })
      .select("id, team_id, playbook_id, side, formation, subcategory, name, canvas_data, created_at, updated_at")
      .single()

    if (playError || !play) {
      console.error("[POST /api/plays]", playError)
      return NextResponse.json({ error: "Failed to create play" }, { status: 500 })
    }

    return NextResponse.json({
      id: play.id,
      teamId: play.team_id,
      playbookId: play.playbook_id || null,
      side: play.side,
      formation: play.formation,
      subcategory: play.subcategory || null,
      name: play.name,
      canvasData: play.canvas_data,
      createdAt: play.created_at,
      updatedAt: play.updated_at,
    })
  } catch (error: any) {
    console.error("[POST /api/plays]", error)
    return NextResponse.json(
      { error: error.message || "Failed to create play" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
