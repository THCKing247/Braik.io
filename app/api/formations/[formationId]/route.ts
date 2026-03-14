import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission } from "@/lib/auth/rbac"

/**
 * GET /api/formations/[formationId]
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ formationId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { formationId } = await params
    if (!formationId) {
      return NextResponse.json({ error: "formationId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: formation, error } = await supabase
      .from("formations")
      .select("id, team_id, playbook_id, side, name, parent_formation_id, template_data, created_at, updated_at")
      .eq("id", formationId)
      .maybeSingle()

    if (error || !formation) {
      return NextResponse.json({ error: "Formation not found" }, { status: 404 })
    }

    await requireTeamAccess(formation.team_id)

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
    console.error("[GET /api/formations/[formationId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to load formation" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * PATCH /api/formations/[formationId]
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ formationId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { formationId } = await params
    if (!formationId) {
      return NextResponse.json({ error: "formationId is required" }, { status: 400 })
    }

    const body = (await request.json()) as {
      name?: string
      templateData?: unknown
      parentFormationId?: string | null
    }

    const supabase = getSupabaseServer()

    const { data: existing, error: fetchError } = await supabase
      .from("formations")
      .select("id, team_id, side")
      .eq("id", formationId)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Formation not found" }, { status: 404 })
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
    if (body.parentFormationId !== undefined) updateData.parent_formation_id = body.parentFormationId

    const { data: formation, error: updateError } = await supabase
      .from("formations")
      .update(updateData)
      .eq("id", formationId)
      .select("id, team_id, playbook_id, side, name, parent_formation_id, template_data, created_at, updated_at")
      .single()

    if (updateError || !formation) {
      console.error("[PATCH /api/formations/[formationId]]", updateError)
      return NextResponse.json({ error: "Failed to update formation" }, { status: 500 })
    }

    if (body.name !== undefined) {
      const { error: playsUpdateError } = await supabase
        .from("plays")
        .update({ formation: formation.name, updated_at: new Date().toISOString() })
        .eq("formation_id", formationId)
      if (playsUpdateError) {
        console.error("[PATCH /api/formations/[formationId]] sync plays.formation", playsUpdateError)
      }
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
    console.error("[PATCH /api/formations/[formationId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to update formation" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * DELETE /api/formations/[formationId]
 * Cascades: delete all plays (direct + in sub-formations), then all sub-formations, then the formation.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ formationId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { formationId } = await params
    if (!formationId) {
      return NextResponse.json({ error: "formationId is required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: existing, error: fetchError } = await supabase
      .from("formations")
      .select("id, team_id, side")
      .eq("id", formationId)
      .maybeSingle()

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Formation not found" }, { status: 404 })
    }

    const side = existing.side as string
    if (side === "offense") {
      await requireTeamPermission(existing.team_id, "edit_offense_plays")
    } else if (side === "defense") {
      await requireTeamPermission(existing.team_id, "edit_defense_plays")
    } else {
      await requireTeamPermission(existing.team_id, "edit_special_teams_plays")
    }

    // Get all sub-formations under this formation
    const { data: subFormations, error: subFetchError } = await supabase
      .from("sub_formations")
      .select("id")
      .eq("formation_id", formationId)

    if (subFetchError) {
      console.error("[DELETE /api/formations/[formationId]] fetch sub-formations", subFetchError)
      return NextResponse.json({ error: "Failed to delete formation" }, { status: 500 })
    }

    const subFormationIds = (subFormations ?? []).map((s) => s.id)

    // Delete all plays: direct (formation_id) and those in sub-formations (sub_formation_id in list)
    const { error: directPlaysError } = await supabase
      .from("plays")
      .delete()
      .eq("formation_id", formationId)

    if (directPlaysError) {
      console.error("[DELETE /api/formations/[formationId]] delete plays", directPlaysError)
      return NextResponse.json({ error: "Failed to delete formation" }, { status: 500 })
    }

    if (subFormationIds.length > 0) {
      const { error: subPlaysError } = await supabase
        .from("plays")
        .delete()
        .in("sub_formation_id", subFormationIds)
      if (subPlaysError) {
        console.error("[DELETE /api/formations/[formationId]] delete sub-formation plays", subPlaysError)
        return NextResponse.json({ error: "Failed to delete formation" }, { status: 500 })
      }
    }

    // Delete sub-formations
    if (subFormationIds.length > 0) {
      const { error: subDeleteError } = await supabase
        .from("sub_formations")
        .delete()
        .in("id", subFormationIds)
      if (subDeleteError) {
        console.error("[DELETE /api/formations/[formationId]] delete sub-formations", subDeleteError)
        return NextResponse.json({ error: "Failed to delete formation" }, { status: 500 })
      }
    }

    // Delete the formation
    const { error: deleteError } = await supabase.from("formations").delete().eq("id", formationId)

    if (deleteError) {
      console.error("[DELETE /api/formations/[formationId]]", deleteError)
      return NextResponse.json({ error: "Failed to delete formation" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[DELETE /api/formations/[formationId]]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to delete formation" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
