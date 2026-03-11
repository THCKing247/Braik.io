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
