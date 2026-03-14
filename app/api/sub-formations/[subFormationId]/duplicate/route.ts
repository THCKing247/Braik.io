import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission } from "@/lib/auth/rbac"

const DEFAULT_TEMPLATE = { fieldView: "HALF", shapes: [], paths: [] }

/**
 * POST /api/sub-formations/[subFormationId]/duplicate
 * Creates a new sub-formation under the same formation with name "X Copy", same side and template_data.
 * Does not duplicate plays.
 */
export async function POST(
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

    const { data: source, error: fetchError } = await supabase
      .from("sub_formations")
      .select("id, team_id, formation_id, side, name, template_data")
      .eq("id", subFormationId)
      .maybeSingle()

    if (fetchError || !source) {
      return NextResponse.json({ error: "Sub-formation not found" }, { status: 404 })
    }

    await requireTeamAccess(source.team_id)
    const side = source.side as string
    if (side === "offense") {
      await requireTeamPermission(source.team_id, "edit_offense_plays")
    } else if (side === "defense") {
      await requireTeamPermission(source.team_id, "edit_defense_plays")
    } else {
      await requireTeamPermission(source.team_id, "edit_special_teams_plays")
    }

    const newName = `${(source.name ?? "").trim()} Copy`
    const templateData =
      source.template_data != null && typeof source.template_data === "object"
        ? JSON.parse(JSON.stringify(source.template_data))
        : DEFAULT_TEMPLATE

    const { data: subFormation, error: insertError } = await supabase
      .from("sub_formations")
      .insert({
        team_id: source.team_id,
        formation_id: source.formation_id,
        side: source.side,
        name: newName,
        template_data: templateData,
      })
      .select("id, team_id, formation_id, side, name, template_data, created_at, updated_at")
      .single()

    if (insertError || !subFormation) {
      console.error("[POST /api/sub-formations/[subFormationId]/duplicate]", insertError)
      return NextResponse.json({ error: "Failed to duplicate sub-formation" }, { status: 500 })
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
    console.error("[POST /api/sub-formations/[subFormationId]/duplicate]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to duplicate sub-formation" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
