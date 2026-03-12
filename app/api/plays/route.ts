import { NextResponse } from "next/server"
import { getServerSession, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
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
      .select("id, team_id, playbook_id, formation_id, sub_formation_id, side, formation, subcategory, name, play_type, canvas_data, created_at, updated_at")
      .eq("team_id", teamId)

    if (side) {
      query = query.eq("side", side)
    }

    const { data: plays, error: playsError } = await query.order("formation", { ascending: true }).order("name", { ascending: true })

    if (playsError) {
      console.error("[GET /api/plays]", playsError)
      return NextResponse.json({ error: "Failed to load plays" }, { status: 500 })
    }

    const subFormationIds = [...new Set((plays ?? []).map((p) => (p as { sub_formation_id?: string }).sub_formation_id).filter(Boolean))] as string[]
    const subFormationNameMap = new Map<string, string>()
    if (subFormationIds.length > 0) {
      const { data: subRows } = await supabase.from("sub_formations").select("id, name").in("id", subFormationIds)
      subRows?.forEach((r) => subFormationNameMap.set(r.id, r.name?.trim() ?? ""))
    }

    const formatted = (plays ?? []).map((p) => {
      const sfId = (p as { sub_formation_id?: string }).sub_formation_id ?? null
      const playType = (p as { play_type?: string | null }).play_type ?? null
      return {
        id: p.id,
        teamId: p.team_id,
        playbookId: p.playbook_id ?? null,
        formationId: (p as { formation_id?: string }).formation_id ?? null,
        subFormationId: sfId,
        side: p.side,
        formation: p.formation,
        subFormation: sfId ? subFormationNameMap.get(sfId) ?? null : null,
        subcategory: p.subcategory ?? null,
        name: p.name,
        playType: playType && ["run", "pass", "rpo", "screen"].includes(playType) ? playType : null,
        canvasData: p.canvas_data,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }
    })

    const res = NextResponse.json(formatted)
    if (session.refreshedSession) applyRefreshedSessionCookies(res, session.refreshedSession)
    return res
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[GET /api/plays]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to load plays" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
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

    let body: {
      teamId?: string
      playbookId?: string | null
      formationId?: string | null
      subFormationId?: string | null
      side?: string
      formation?: string
      subcategory?: string | null
      name?: string
      playType?: "run" | "pass" | "rpo" | "screen" | null
      canvasData?: unknown
    }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { teamId, playbookId, formationId, subFormationId, side, formation, subcategory, name, playType, canvasData } = body

    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    if (!side || !["offense", "defense", "special_teams"].includes(side)) {
      return NextResponse.json({ error: "side must be offense, defense, or special_teams" }, { status: 400 })
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

    // Verify formation exists and belong to team if provided; use its name for denormalized play.formation
    let formationNameForInsert = formation?.trim() ?? ""
    if (formationId) {
      const { data: formationRow } = await supabase
        .from("formations")
        .select("id, name")
        .eq("id", formationId)
        .eq("team_id", teamId)
        .maybeSingle()
      if (!formationRow) {
        return NextResponse.json({ error: "Formation not found" }, { status: 404 })
      }
      formationNameForInsert = formationRow.name?.trim() ?? formationNameForInsert
    }
    if (!formationNameForInsert) {
      return NextResponse.json({ error: "formation is required" }, { status: 400 })
    }

    let subFormationNameForInsert: string | null = null
    if (subFormationId) {
      const { data: subRow } = await supabase
        .from("sub_formations")
        .select("id, name, formation_id")
        .eq("id", subFormationId)
        .eq("team_id", teamId)
        .maybeSingle()
      if (!subRow) {
        return NextResponse.json({ error: "Sub-formation not found" }, { status: 404 })
      }
      if (formationId && subRow.formation_id !== formationId) {
        return NextResponse.json({ error: "Sub-formation does not belong to the given formation" }, { status: 400 })
      }
      subFormationNameForInsert = subRow.name?.trim() ?? null
    }

    const insertPayload: Record<string, unknown> = {
      team_id: teamId,
      playbook_id: playbookId ?? null,
      side,
      formation: formationNameForInsert,
      subcategory: subcategory?.trim() ?? null,
      name: name.trim(),
      canvas_data: canvasData ?? null,
    }
    if (formationId != null) {
      insertPayload.formation_id = formationId
    }
    if (subFormationId != null) {
      insertPayload.sub_formation_id = subFormationId
    }
    if (playType != null && ["run", "pass", "rpo", "screen"].includes(playType)) {
      insertPayload.play_type = playType
    }

    // Create play
    const { data: play, error: playError } = await supabase
      .from("plays")
      .insert(insertPayload)
      .select("id, team_id, playbook_id, formation_id, sub_formation_id, side, formation, subcategory, name, play_type, canvas_data, created_at, updated_at")
      .single()

    if (playError || !play) {
      console.error("[POST /api/plays]", playError)
      const message = playError?.message ?? "Failed to create play"
      return NextResponse.json(
        { error: "Failed to create play", details: message },
        { status: 500 }
      )
    }

    const res = NextResponse.json({
      id: play.id,
      teamId: play.team_id,
      playbookId: play.playbook_id ?? null,
      formationId: (play as { formation_id?: string }).formation_id ?? null,
      subFormationId: (play as { sub_formation_id?: string }).sub_formation_id ?? null,
      side: play.side,
      formation: play.formation,
      subFormation: subFormationNameForInsert,
      subcategory: play.subcategory ?? null,
      name: play.name,
      playType: (play as { play_type?: string | null }).play_type ?? null,
      canvasData: play.canvas_data,
      createdAt: play.created_at,
      updatedAt: play.updated_at,
    })
    if (session.refreshedSession) applyRefreshedSessionCookies(res, session.refreshedSession)
    return res
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[POST /api/plays]", error)
    const message = err?.message ?? "Failed to create play"
    const status = message.includes("Access denied") ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
