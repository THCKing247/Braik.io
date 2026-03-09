import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess, requireTeamPermission } from "@/lib/auth/rbac"

/**
 * GET /api/roster/depth-chart/position-labels?teamId=xxx&unit=xxx
 * Returns position labels for the team/unit.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    const unit = searchParams.get("unit")

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
      .from("depth_chart_position_labels")
      .select("id, unit, position, label")
      .eq("team_id", teamId)

    if (unit) {
      query = query.eq("unit", unit)
    }

    const { data: labels, error: labelsError } = await query.order("unit", { ascending: true }).order("position", { ascending: true })

    if (labelsError) {
      console.error("[GET /api/roster/depth-chart/position-labels]", labelsError)
      return NextResponse.json({ error: "Failed to load position labels" }, { status: 500 })
    }

    // Format as array of { position, label } objects
    const formatted = (labels ?? []).map((l) => ({
      position: l.position,
      label: l.label,
    }))

    return NextResponse.json(formatted)
  } catch (error: any) {
    console.error("[GET /api/roster/depth-chart/position-labels]", error)
    return NextResponse.json(
      { error: error.message || "Failed to load position labels" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}

/**
 * PATCH /api/roster/depth-chart/position-labels?teamId=xxx
 * Updates position labels for the team.
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get("teamId")
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    const body = (await request.json()) as {
      labels?: Array<{ unit: string; position: string; label: string }>
    }

    const { labels = [] } = body

    const supabase = getSupabaseServer()

    // Upsert labels
    const labelsToUpsert = labels.map((l) => ({
      team_id: teamId,
      unit: l.unit,
      position: l.position,
      label: l.label,
    }))

    const { error: upsertError } = await supabase
      .from("depth_chart_position_labels")
      .upsert(labelsToUpsert, { onConflict: "team_id,unit,position" })

    if (upsertError) {
      console.error("[PATCH /api/roster/depth-chart/position-labels]", upsertError)
      return NextResponse.json({ error: "Failed to update position labels" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[PATCH /api/roster/depth-chart/position-labels]", error)
    return NextResponse.json(
      { error: error.message || "Failed to update position labels" },
      { status: error.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
