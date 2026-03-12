import { NextResponse } from "next/server"
import { getServerSession, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission } from "@/lib/auth/rbac"

const VALID_PLAY_TYPES = ["run", "pass", "rpo", "screen"] as const

function safePlayTypeFromRow(row: Record<string, unknown> | null): (typeof VALID_PLAY_TYPES)[number] | null {
  if (!row) return null
  const raw = row.play_type
  if (typeof raw !== "string" || !VALID_PLAY_TYPES.includes(raw as (typeof VALID_PLAY_TYPES)[number])) return null
  return raw as (typeof VALID_PLAY_TYPES)[number]
}

/**
 * GET /api/plays/[playId]
 * Returns a single play by ID.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ playId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playId } = await params
    if (!playId) {
      return NextResponse.json({ error: "playId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    // Get play (play_type omitted until migration 20260322000000_plays_play_type.sql is applied)
    const { data: play, error: playError } = await supabase
      .from("plays")
      .select("id, team_id, playbook_id, formation_id, sub_formation_id, side, formation, subcategory, name, canvas_data, created_at, updated_at")
      .eq("id", playId)
      .maybeSingle()

    if (playError || !play) {
      return NextResponse.json({ error: "Play not found" }, { status: 404 })
    }

    await requireTeamAccess(play.team_id)

    const subFormationId = (play as { sub_formation_id?: string }).sub_formation_id ?? null
    let subFormationName: string | null = null
    if (subFormationId) {
      const { data: subRow } = await supabase.from("sub_formations").select("name").eq("id", subFormationId).maybeSingle()
      subFormationName = subRow?.name?.trim() ?? null
    }

    const res = NextResponse.json({
      id: play.id,
      teamId: play.team_id,
      playbookId: play.playbook_id ?? null,
      formationId: (play as { formation_id?: string }).formation_id ?? null,
      subFormationId,
      side: play.side,
      formation: play.formation,
      subFormation: subFormationName,
      subcategory: play.subcategory ?? null,
      name: play.name,
      playType: safePlayTypeFromRow(play as Record<string, unknown>),
      canvasData: play.canvas_data,
      createdAt: play.created_at,
      updatedAt: play.updated_at,
    })
    if (session.refreshedSession) applyRefreshedSessionCookies(res, session.refreshedSession)
    return res
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[GET /api/plays/[playId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to load play" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * PATCH /api/plays/[playId]
 * Updates a play.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ playId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playId } = await params
    if (!playId) {
      return NextResponse.json({ error: "playId is required" }, { status: 400 })
    }

    const body = (await request.json()) as {
      name?: string
      canvasData?: unknown
      formation?: string
      subcategory?: string | null
      subFormationId?: string | null
      side?: string
      formationId?: string | null
      playType?: "run" | "pass" | "rpo" | "screen" | null
    }

    const supabase = getSupabaseServer()

    // Get existing play to check permissions
    const { data: existingPlay, error: existingError } = await supabase
      .from("plays")
      .select("id, team_id, side")
      .eq("id", playId)
      .maybeSingle()

    if (existingError || !existingPlay) {
      return NextResponse.json({ error: "Play not found" }, { status: 404 })
    }

    const side = body.side || existingPlay.side

    // Check permissions based on side
    if (side === "offense") {
      await requireTeamPermission(existingPlay.team_id, "edit_offense_plays")
    } else if (side === "defense") {
      await requireTeamPermission(existingPlay.team_id, "edit_defense_plays")
    } else {
      await requireTeamPermission(existingPlay.team_id, "edit_special_teams_plays")
    }

    // Build update data
    const updateData: {
      name?: string
      canvas_data?: unknown
      formation?: string
      formation_id?: string | null
      sub_formation_id?: string | null
      subcategory?: string | null
      side?: string
      updated_at?: string
    } = {}

    if (body.name !== undefined) {
      updateData.name = body.name.trim()
    }
    if (body.canvasData !== undefined) {
      updateData.canvas_data = body.canvasData
    }
    if (body.formation !== undefined) {
      updateData.formation = body.formation.trim()
    }
    if (body.formationId !== undefined) {
      updateData.formation_id = body.formationId
      if (body.formationId != null) {
        const { data: formationRow } = await supabase
          .from("formations")
          .select("name")
          .eq("id", body.formationId)
          .eq("team_id", existingPlay.team_id)
          .maybeSingle()
        if (formationRow?.name) updateData.formation = formationRow.name.trim()
      }
    }
    if (body.subFormationId !== undefined) {
      updateData.sub_formation_id = body.subFormationId
    }
    if (body.subcategory !== undefined) {
      updateData.subcategory = body.subcategory?.trim() ?? null
    }
    if (body.side !== undefined) {
      updateData.side = body.side
    }
    // play_type omitted until migration 20260322000000_plays_play_type.sql is applied
    updateData.updated_at = new Date().toISOString()

    // Update play (play_type omitted from select until migration 20260322000000_plays_play_type.sql is applied)
    const { data: play, error: updateError } = await supabase
      .from("plays")
      .update(updateData)
      .eq("id", playId)
      .select("id, team_id, playbook_id, formation_id, sub_formation_id, side, formation, subcategory, name, canvas_data, created_at, updated_at")
      .single()

    if (updateError || !play) {
      console.error("[PATCH /api/plays/[playId]]", updateError)
      return NextResponse.json({ error: "Failed to update play" }, { status: 500 })
    }

    const updatedSubFormationId = (play as { sub_formation_id?: string }).sub_formation_id ?? null
    let subFormationName: string | null = null
    if (updatedSubFormationId) {
      const { data: subRow } = await supabase.from("sub_formations").select("name").eq("id", updatedSubFormationId).maybeSingle()
      subFormationName = subRow?.name?.trim() ?? null
    }

    const res = NextResponse.json({
      id: play.id,
      teamId: play.team_id,
      playbookId: play.playbook_id ?? null,
      formationId: (play as { formation_id?: string }).formation_id ?? null,
      subFormationId: updatedSubFormationId,
      side: play.side,
      formation: play.formation,
      subFormation: subFormationName,
      subcategory: play.subcategory ?? null,
      name: play.name,
      playType: safePlayTypeFromRow(play as Record<string, unknown>),
      canvasData: play.canvas_data,
      createdAt: play.created_at,
      updatedAt: play.updated_at,
    })
    if (session.refreshedSession) applyRefreshedSessionCookies(res, session.refreshedSession)
    return res
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[PATCH /api/plays/[playId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to update play" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * DELETE /api/plays/[playId]
 * Deletes a play. Formations are not modified or auto-deleted (they are first-class records).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ playId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { playId } = await params
    if (!playId) {
      return NextResponse.json({ error: "playId is required" }, { status: 400 })
}

    const supabase = getSupabaseServer()

    // Get existing play to check permissions
    const { data: existingPlay, error: existingError } = await supabase
      .from("plays")
      .select("id, team_id, side")
      .eq("id", playId)
      .maybeSingle()

    if (existingError || !existingPlay) {
      return NextResponse.json({ error: "Play not found" }, { status: 404 })
    }

    // Check permissions based on side
    if (existingPlay.side === "offense") {
      await requireTeamPermission(existingPlay.team_id, "edit_offense_plays")
    } else if (existingPlay.side === "defense") {
      await requireTeamPermission(existingPlay.team_id, "edit_defense_plays")
    } else {
      await requireTeamPermission(existingPlay.team_id, "edit_special_teams_plays")
    }

    // Delete play
    const { error: deleteError } = await supabase.from("plays").delete().eq("id", playId)

    if (deleteError) {
      console.error("[DELETE /api/plays/[playId]]", deleteError)
      return NextResponse.json({ error: "Failed to delete play" }, { status: 500 })
    }

    const res = NextResponse.json({ success: true })
    if (session.refreshedSession) applyRefreshedSessionCookies(res, session.refreshedSession)
    return res
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[DELETE /api/plays/[playId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to delete play" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
