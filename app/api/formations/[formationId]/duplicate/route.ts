import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission } from "@/lib/auth/rbac"

/**
 * POST /api/formations/[formationId]/duplicate
 * Creates a new formation under the same playbook with copied name (append " Copy"), side, template_data.
 * Does not duplicate plays.
 */
export async function POST(
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

    const { data: source, error: fetchError } = await supabase
      .from("formations")
      .select("id, team_id, playbook_id, side, name, parent_formation_id, template_data")
      .eq("id", formationId)
      .maybeSingle()

    if (fetchError || !source) {
      return NextResponse.json({ error: "Formation not found" }, { status: 404 })
    }

    await requireTeamAccess(source.team_id)
    if (source.side === "offense") {
      await requireTeamPermission(source.team_id, "edit_offense_plays")
    } else if (source.side === "defense") {
      await requireTeamPermission(source.team_id, "edit_defense_plays")
    } else {
      await requireTeamPermission(source.team_id, "edit_special_teams_plays")
    }

    const newName = `${(source.name ?? "").trim()} Copy`

    const { data: formation, error: insertError } = await supabase
      .from("formations")
      .insert({
        team_id: source.team_id,
        playbook_id: source.playbook_id ?? null,
        side: source.side,
        name: newName,
        parent_formation_id: source.parent_formation_id ?? null,
        template_data: source.template_data ?? { fieldView: "HALF", shapes: [], paths: [] },
      })
      .select("id, team_id, playbook_id, side, name, parent_formation_id, template_data, created_at, updated_at")
      .single()

    if (insertError || !formation) {
      console.error("[POST /api/formations/[formationId]/duplicate]", insertError)
      return NextResponse.json({ error: "Failed to duplicate formation" }, { status: 500 })
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
    console.error("[POST /api/formations/[formationId]/duplicate]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to duplicate formation" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
