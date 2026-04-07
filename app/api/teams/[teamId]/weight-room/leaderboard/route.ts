import { NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

/**
 * GET /api/teams/[teamId]/weight-room/leaderboard?scope=overall|position&positionGroup=
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })

    const { membership } = await requireTeamAccess(teamId)
    if (!canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const url = new URL(request.url)
    const scope = url.searchParams.get("scope") || "overall"
    const positionGroup = url.searchParams.get("positionGroup")?.trim() || ""

    const supabase = getSupabaseServer()
    let q = supabase
      .from("players")
      .select(
        "id, first_name, last_name, position_group, max_bench_lbs, max_squat_lbs, max_power_clean_lbs, max_deadlift_lbs"
      )
      .eq("team_id", teamId)
      .neq("status", "inactive")

    if (scope === "position" && positionGroup) {
      q = q.eq("position_group", positionGroup)
    }

    const { data: players, error } = await q
    if (error) {
      console.error("[leaderboard]", error)
      return NextResponse.json({ error: "Failed" }, { status: 500 })
    }

    const rows = (players ?? []).map((p) => {
      const bench = p.max_bench_lbs ?? 0
      const squat = p.max_squat_lbs ?? 0
      const clean = p.max_power_clean_lbs ?? 0
      const dead = p.max_deadlift_lbs ?? 0
      return {
        playerId: p.id,
        name: `${p.first_name} ${p.last_name}`.trim(),
        positionGroup: p.position_group,
        bench,
        squat,
        clean,
        dead,
        combined: bench + squat + clean + dead,
      }
    })

    const byCombined = [...rows].sort((a, b) => b.combined - a.combined).map((r, i) => ({ ...r, rank: i + 1 }))
    const byBench = [...rows].sort((a, b) => b.bench - a.bench).map((r, i) => ({ ...r, rank: i + 1 }))

    return NextResponse.json({
      overall: byCombined,
      bench: byBench,
      squat: [...rows].sort((a, b) => b.squat - a.squat).map((r, i) => ({ ...r, rank: i + 1 })),
      clean: [...rows].sort((a, b) => b.clean - a.clean).map((r, i) => ({ ...r, rank: i + 1 })),
      deadlift: [...rows].sort((a, b) => b.dead - a.dead).map((r, i) => ({ ...r, rank: i + 1 })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
