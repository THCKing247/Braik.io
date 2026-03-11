import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission } from "@/lib/auth/rbac"

/**
 * GET /api/formations?teamId=xxx&side=xxx
 * Returns formations for the team, optionally filtered by side.
 * Formations are first-class records; deleting plays never deletes formations.
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
      .from("formations")
      .select("id, team_id, playbook_id, side, name, parent_formation_id, template_data, created_at, updated_at")
      .eq("team_id", teamId)

    if (side && ["offense", "defense", "special_teams"].includes(side)) {
      query = query.eq("side", side)
    }

    const { data: formations, error } = await query.order("name", { ascending: true })

    if (error) {
      console.error("[GET /api/formations]", error)
      return NextResponse.json({ error: "Failed to load formations" }, { status: 500 })
    }

    const formatted = (formations ?? []).map((f) => ({
      id: f.id,
      teamId: f.team_id,
      playbookId: f.playbook_id ?? null,
      side: f.side,
      name: f.name,
      parentFormationId: f.parent_formation_id ?? null,
      templateData: f.template_data,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    }))

    return NextResponse.json(formatted)
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[GET /api/formations]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to load formations" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * POST /api/formations
 * Creates a new formation.
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
      name?: string
      parentFormationId?: string | null
      templateData?: unknown
    }

    const { teamId, playbookId, side, name, parentFormationId, templateData } = body

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
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

    const payload = {
      team_id: teamId,
      playbook_id: playbookId ?? null,
      side,
      name: name.trim(),
      parent_formation_id: parentFormationId ?? null,
      template_data: templateData ?? { fieldView: "HALF", shapes: [], paths: [] },
    }

    const { data: formation, error: insertError } = await supabase
      .from("formations")
      .insert(payload)
      .select("id, team_id, playbook_id, side, name, parent_formation_id, template_data, created_at, updated_at")
      .single()

    if (insertError || !formation) {
      console.error("[POST /api/formations]", insertError)
      return NextResponse.json({ error: "Failed to create formation" }, { status: 500 })
    }

    return NextResponse.json({
      id: formation.id,
      teamId: formation.team_id,
      playbookId: formation.playbook_id ?? null,
      side: formation.side,
      name: formation.name,
      parentFormationId: formation.parent_formation_id ?? null,
      templateData: formation.template_data,
      createdAt: formation.created_at,
      updatedAt: formation.updated_at,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[POST /api/formations]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to create formation" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
