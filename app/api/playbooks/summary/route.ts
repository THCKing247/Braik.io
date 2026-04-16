import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { loadPlaybooksSummaryForTeam } from "@/lib/playbooks/load-playbooks-summary-for-team"

/**
 * GET /api/playbooks/summary?teamId=xxx
 * Browse/list payload: playbook rows with per-playbook formation and play counts (no canvas/template blobs).
 */
export async function GET(request: Request) {
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

    const supabase = getSupabaseServer()
    const { data: team } = await supabase.from("teams").select("id").eq("id", teamId).maybeSingle()
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    await requireTeamAccess(teamId)

    const formatted = await loadPlaybooksSummaryForTeam(supabase, teamId)
    return NextResponse.json(formatted)
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[GET /api/playbooks/summary]", error)
    return NextResponse.json(
      { error: err?.message ?? "Failed to load playbook summary" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
