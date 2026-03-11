import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission } from "@/lib/auth/rbac"

/**
 * GET /api/sub-formations?teamId=xxx&formationId=xxx&side=xxx
 * Returns sub-formations for the team, optionally filtered by formation and side.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const formationId = searchParams.get("formationId")
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
      .from("sub_formations")
      .select("id, team_id, formation_id, side, name, created_at, updated_at")
      .eq("team_id", teamId)

    if (formationId) {
      query = query.eq("formation_id", formationId)
    }
    if (side && ["offense", "defense", "special_teams"].includes(side)) {
      query = query.eq("side", side)
    }

    const { data: subFormations, error } = await query.order("name", { ascending: true })

    if (error) {
      console.error("[GET /api/sub-formations]", error)
      return NextResponse.json({ error: "Failed to load sub-formations" }, { status: 500 })
    }

    const formatted = (subFormations ?? []).map((s) => ({
      id: s.id,
      teamId: s.team_id,
      formationId: s.formation_id,
      side: s.side,
      name: s.name,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }))

    return NextResponse.json(formatted)
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[GET /api/sub-formations]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to load sub-formations" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * POST /api/sub-formations
 * Creates a new sub-formation under a formation.
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as {
      teamId?: string
      formationId?: string
      side?: string
      name?: string
    }

    const { teamId, formationId, side, name } = body

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }
    if (!formationId) {
      return NextResponse.json({ error: "formationId is required" }, { status: 400 })
    }
    if (!side || !["offense", "defense", "special_teams"].includes(side)) {
      return NextResponse.json({ error: "side must be offense, defense, or special_teams" }, { status: 400 })
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    if (side === "offense") {
      await requireTeamPermission(teamId, "edit_offense_plays")
    } else if (side === "defense") {
      await requireTeamPermission(teamId, "edit_defense_plays")
    } else {
      await requireTeamPermission(teamId, "edit_special_teams_plays")
    }

    const supabase = getSupabaseServer()

    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    const { data: formation } = await supabase
      .from("formations")
      .select("id, side")
      .eq("id", formationId)
      .eq("team_id", teamId)
      .maybeSingle()
    if (!formation) {
      return NextResponse.json({ error: "Formation not found" }, { status: 404 })
    }

    const { data: subFormation, error: insertError } = await supabase
      .from("sub_formations")
      .insert({
        team_id: teamId,
        formation_id: formationId,
        side: formation.side,
        name: name.trim(),
      })
      .select("id, team_id, formation_id, side, name, created_at, updated_at")
      .single()

    if (insertError || !subFormation) {
      console.error("[POST /api/sub-formations]", insertError)
      return NextResponse.json({ error: "Failed to create sub-formation" }, { status: 500 })
    }

    return NextResponse.json({
      id: subFormation.id,
      teamId: subFormation.team_id,
      formationId: subFormation.formation_id,
      side: subFormation.side,
      name: subFormation.name,
      createdAt: subFormation.created_at,
      updatedAt: subFormation.updated_at,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[POST /api/sub-formations]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to create sub-formation" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
