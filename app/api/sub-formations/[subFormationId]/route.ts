import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission } from "@/lib/auth/rbac"

/**
 * GET /api/sub-formations/[subFormationId]
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ subFormationId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { subFormationId } = await params
    if (!subFormationId) {
      return NextResponse.json({ error: "subFormationId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: subFormation, error } = await supabase
      .from("sub_formations")
      .select("id, team_id, formation_id, side, name, template_data, created_at, updated_at")
      .eq("id", subFormationId)
      .maybeSingle()

    if (error || !subFormation) {
      return NextResponse.json({ error: "Sub-formation not found" }, { status: 404 })
    }

    await requireTeamAccess(subFormation.team_id)

    const defaultTemplate = { fieldView: "HALF", shapes: [], paths: [] }
    return NextResponse.json({
      id: subFormation.id,
      teamId: subFormation.team_id,
      formationId: subFormation.formation_id,
      side: subFormation.side,
      name: subFormation.name,
      templateData: (subFormation as { template_data?: unknown }).template_data ?? defaultTemplate,
      createdAt: subFormation.created_at,
      updatedAt: subFormation.updated_at,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[GET /api/sub-formations/[subFormationId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to load sub-formation" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * PATCH /api/sub-formations/[subFormationId]
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ subFormationId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { subFormationId } = await params
    if (!subFormationId) {
      return NextResponse.json({ error: "subFormationId is required" }, { status: 400 })
    }

    const body = (await request.json()) as { name?: string; templateData?: unknown }

    const supabase = getSupabaseServer()

    const { data: existing, error: fetchError } = await supabase
      .from("sub_formations")
      .select("id, team_id, side")
      .eq("id", subFormationId)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Sub-formation not found" }, { status: 404 })
    }

    const side = existing.side as string
    if (side === "offense") {
      await requireTeamPermission(existing.team_id, "edit_offense_plays")
    } else if (side === "defense") {
      await requireTeamPermission(existing.team_id, "edit_defense_plays")
    } else {
      await requireTeamPermission(existing.team_id, "edit_special_teams_plays")
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) updateData.name = body.name.trim()
    if (body.templateData !== undefined) updateData.template_data = body.templateData

    const { data: subFormation, error: updateError } = await supabase
      .from("sub_formations")
      .update(updateData)
      .eq("id", subFormationId)
      .select("id, team_id, formation_id, side, name, template_data, created_at, updated_at")
      .single()

    if (updateError || !subFormation) {
      console.error("[PATCH /api/sub-formations/[subFormationId]]", updateError)
      return NextResponse.json({ error: "Failed to update sub-formation" }, { status: 500 })
    }

    const defaultTemplate = { fieldView: "HALF", shapes: [], paths: [] }
    return NextResponse.json({
      id: subFormation.id,
      teamId: subFormation.team_id,
      formationId: subFormation.formation_id,
      side: subFormation.side,
      name: subFormation.name,
      templateData: (subFormation as { template_data?: unknown }).template_data ?? defaultTemplate,
      createdAt: subFormation.created_at,
      updatedAt: subFormation.updated_at,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[PATCH /api/sub-formations/[subFormationId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to update sub-formation" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * DELETE /api/sub-formations/[subFormationId]
 * Sets sub_formation_id to null on plays that referenced this sub-formation.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ subFormationId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { subFormationId } = await params
    if (!subFormationId) {
      return NextResponse.json({ error: "subFormationId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: existing, error: fetchError } = await supabase
      .from("sub_formations")
      .select("id, team_id, side")
      .eq("id", subFormationId)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Sub-formation not found" }, { status: 404 })
    }

    const side = existing.side as string
    if (side === "offense") {
      await requireTeamPermission(existing.team_id, "edit_offense_plays")
    } else if (side === "defense") {
      await requireTeamPermission(existing.team_id, "edit_defense_plays")
    } else {
      await requireTeamPermission(existing.team_id, "edit_special_teams_plays")
    }

    await supabase
      .from("plays")
      .update({ sub_formation_id: null, updated_at: new Date().toISOString() })
      .eq("sub_formation_id", subFormationId)

    const { error: deleteError } = await supabase.from("sub_formations").delete().eq("id", subFormationId)

    if (deleteError) {
      console.error("[DELETE /api/sub-formations/[subFormationId]]", deleteError)
      return NextResponse.json({ error: "Failed to delete sub-formation" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[DELETE /api/sub-formations/[subFormationId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to delete sub-formation" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
