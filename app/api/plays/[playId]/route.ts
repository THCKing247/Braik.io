import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission } from "@/lib/auth/rbac"

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

    // Get play
    const { data: play, error: playError } = await supabase
      .from("plays")
      .select("id, team_id, playbook_id, side, formation, subcategory, name, canvas_data, created_at, updated_at")
      .eq("id", playId)
      .maybeSingle()

    if (playError || !play) {
      return NextResponse.json({ error: "Play not found" }, { status: 404 })
    }

    await requireTeamAccess(play.team_id)

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
    console.error("[GET /api/plays/[playId]]", error)
  return NextResponse.json(
      { error: error.message || "Failed to load play" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
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
      canvasData?: any
      formation?: string
      subcategory?: string | null
      side?: string
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
      canvas_data?: any
      formation?: string
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
    if (body.subcategory !== undefined) {
      updateData.subcategory = body.subcategory?.trim() || null
    }
    if (body.side !== undefined) {
      updateData.side = body.side
    }
    updateData.updated_at = new Date().toISOString()

    // Update play
    const { data: play, error: updateError } = await supabase
      .from("plays")
      .update(updateData)
      .eq("id", playId)
      .select("id, team_id, playbook_id, side, formation, subcategory, name, canvas_data, created_at, updated_at")
      .single()

    if (updateError || !play) {
      console.error("[PATCH /api/plays/[playId]]", updateError)
      return NextResponse.json({ error: "Failed to update play" }, { status: 500 })
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
    console.error("[PATCH /api/plays/[playId]]", error)
  return NextResponse.json(
      { error: error.message || "Failed to update play" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * DELETE /api/plays/[playId]
 * Deletes a play.
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

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[DELETE /api/plays/[playId]]", error)
  return NextResponse.json(
      { error: error.message || "Failed to delete play" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
  )
  }
}
