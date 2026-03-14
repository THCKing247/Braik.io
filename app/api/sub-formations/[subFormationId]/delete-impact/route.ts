import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"

/**
 * GET /api/sub-formations/[subFormationId]/delete-impact
 * Returns counts of what would be deleted (for confirmation dialog).
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

    const { data: subFormation, error: subError } = await supabase
      .from("sub_formations")
      .select("id, team_id")
      .eq("id", subFormationId)
      .maybeSingle()

    if (subError || !subFormation) {
      return NextResponse.json({ error: "Sub-formation not found" }, { status: 404 })
    }

    await requireTeamAccess(subFormation.team_id)

    const { count: playsCount, error: playsError } = await supabase
      .from("plays")
      .select("id", { count: "exact", head: true })
      .eq("sub_formation_id", subFormationId)

    if (playsError) {
      console.error("[GET /api/sub-formations/.../delete-impact]", playsError)
      return NextResponse.json({ error: "Failed to get impact" }, { status: 500 })
    }

    return NextResponse.json({
      playsCount: playsCount ?? 0,
    })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[GET /api/sub-formations/.../delete-impact]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to get impact" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
