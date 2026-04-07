import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { getSupabaseServer } from "@/src/lib/supabaseServer"

/**
 * GET — player's own study assignments (linked roster user only)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })

    const session = await getServerSession()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { membership } = await requireTeamAccess(teamId)
    if (canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Use coach assignments API" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: player } = await supabase
      .from("players")
      .select("id")
      .eq("team_id", teamId)
      .eq("user_id", session.user.id)
      .maybeSingle()

    if (!player) return NextResponse.json({ assignments: [] })

    const { data: links } = await supabase
      .from("study_assignment_players")
      .select("assignment_id, status, time_spent_seconds, completed_at")
      .eq("player_id", player.id)

    const ids = (links ?? []).map((l) => l.assignment_id)
    if (ids.length === 0) return NextResponse.json({ assignments: [] })

    const { data: assigns } = await supabase
      .from("study_assignments")
      .select("id, title, due_date, created_at")
      .eq("team_id", teamId)
      .in("id", ids)
      .order("due_date", { ascending: true })

    const { data: items } = await supabase
      .from("study_assignment_items")
      .select("assignment_id, item_type, item_id, sort_order")
      .in("assignment_id", ids)

    const byA = new Map<string, typeof items>()
    ;(items ?? []).forEach((it) => {
      const arr = byA.get(it.assignment_id) ?? []
      arr.push(it)
      byA.set(it.assignment_id, arr)
    })

    const linkMap = new Map((links ?? []).map((l) => [l.assignment_id, l]))

    const out = (assigns ?? []).map((a) => ({
      ...a,
      myStatus: linkMap.get(a.id)?.status,
      timeSpentSeconds: linkMap.get(a.id)?.time_spent_seconds ?? 0,
      completedAt: linkMap.get(a.id)?.completed_at,
      items: (byA.get(a.id) ?? []).sort((x, y) => x.sort_order - y.sort_order),
    }))

    return NextResponse.json({ assignments: out })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
