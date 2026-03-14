import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * GET /api/formations/[formationId]/delete-impact
 * Returns counts of what would be deleted (for confirmation dialog).
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

    const { data: formation, error: formError } = await supabase
      .from("formations")
      .select("id, team_id")
      .eq("id", formationId)
      .maybeSingle()

    if (formError || !formation) {
      return NextResponse.json({ error: "Formation not found" }, { status: 404 })
    }

    await requireTeamAccess(formation.team_id)

    const { data: subFormations, error: subError } = await supabase
      .from("sub_formations")
      .select("id")
      .eq("formation_id", formationId)

    if (subError) {
      console.error("[GET /api/formations/.../delete-impact] sub-formations", subError)
      return NextResponse.json({ error: "Failed to get impact" }, { status: 500 })
    }

    const subFormationIds = (subFormations ?? []).map((s) => s.id)
    const subFormationsCount = subFormationIds.length

    const { count: directPlaysCount, error: directPlaysError } = await supabase
      .from("plays")
      .select("id", { count: "exact", head: true })
      .eq("formation_id", formationId)
      .is("sub_formation_id", null)

    if (directPlaysError) {
      console.error("[GET /api/formations/.../delete-impact] direct plays", directPlaysError)
      return NextResponse.json({ error: "Failed to get impact" }, { status: 500 })
    }

    let subFormationPlaysCount = 0
    if (subFormationIds.length > 0) {
      const { count, error: subPlaysError } = await supabase
        .from("plays")
        .select("id", { count: "exact", head: true })
        .in("sub_formation_id", subFormationIds)
      if (subPlaysError) {
        console.error("[GET /api/formations/.../delete-impact] sub-formation plays", subPlaysError)
        return NextResponse.json({ error: "Failed to get impact" }, { status: 500 })
      }
      subFormationPlaysCount = count ?? 0
    }

    const direct = directPlaysCount ?? 0
    const totalPlaysCount = direct + subFormationPlaysCount

    return NextResponse.json({
      subFormationsCount,
      directPlaysCount: direct,
      subFormationPlaysCount,
      totalPlaysCount,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[GET /api/formations/.../delete-impact]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to get impact" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
