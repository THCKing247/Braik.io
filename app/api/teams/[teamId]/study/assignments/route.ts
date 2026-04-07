import { NextResponse } from "next/server"
import { requireTeamAccess } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { resolveAssignmentPlayerIds } from "@/lib/study-guides-server"

/**
 * GET /api/teams/[teamId]/study/assignments — coach list with status counts
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })

    const { membership } = await requireTeamAccess(teamId)
    if (!canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const supabase = getSupabaseServer()
    const { data: assigns, error } = await supabase
      .from("study_assignments")
      .select("id, title, due_date, assigned_to_type, assigned_position_group, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })

    if (error) return NextResponse.json({ error: "Failed" }, { status: 500 })

    const enriched = await Promise.all(
      (assigns ?? []).map(async (a) => {
        const { data: rows } = await supabase
          .from("study_assignment_players")
          .select("status")
          .eq("assignment_id", a.id)
        const list = rows ?? []
        const notStarted = list.filter((r) => r.status === "not_started").length
        const inProgress = list.filter((r) => r.status === "in_progress").length
        const completed = list.filter((r) => r.status === "completed").length
        return {
          ...a,
          counts: { notStarted, inProgress, completed, total: list.length },
        }
      })
    )

    return NextResponse.json({ assignments: enriched })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

/**
 * POST — create assignment + items + per-player rows
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 })

    const auth = await requireTeamAccess(teamId)
    if (!canEditRoster(auth.membership.role)) {
      return NextResponse.json({ error: "Coach access only" }, { status: 403 })
    }

    const body = (await request.json()) as {
      title?: string
      dueDate?: string | null
      assignedToType?: "team" | "position_group" | "players"
      assignedPositionGroup?: string | null
      playerIds?: string[]
      items?: { itemType: "playbook" | "install_script" | "study_pack"; itemId: string }[]
    }

    if (!body.title?.trim()) return NextResponse.json({ error: "title required" }, { status: 400 })
    if (!body.assignedToType) return NextResponse.json({ error: "assignedToType required" }, { status: 400 })
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "At least one content item required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()

    const { data: assignment, error: aErr } = await supabase
      .from("study_assignments")
      .insert({
        team_id: teamId,
        title: body.title.trim(),
        due_date: body.dueDate ? new Date(body.dueDate).toISOString() : null,
        assigned_to_type: body.assignedToType,
        assigned_position_group: body.assignedPositionGroup?.trim() || null,
        created_by: auth.user.id,
      })
      .select("*")
      .single()

    if (aErr || !assignment) {
      console.error(aErr)
      return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 })
    }

    const itemRows = body.items.map((it, i) => ({
      assignment_id: assignment.id,
      item_type: it.itemType,
      item_id: it.itemId,
      sort_order: i,
    }))

    const { error: iErr } = await supabase.from("study_assignment_items").insert(itemRows)
    if (iErr) {
      await supabase.from("study_assignments").delete().eq("id", assignment.id)
      return NextResponse.json({ error: "Failed to add items" }, { status: 500 })
    }

    const playerIds = await resolveAssignmentPlayerIds(
      supabase,
      teamId,
      body.assignedToType,
      body.assignedPositionGroup ?? null,
      body.playerIds ?? null
    )

    if (playerIds.length > 0) {
      const pr = playerIds.map((player_id) => ({
        assignment_id: assignment.id,
        player_id,
        status: "not_started" as const,
      }))
      await supabase.from("study_assignment_players").insert(pr)
    }

    return NextResponse.json({ assignment })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error"
    if (msg.includes("Access denied")) return NextResponse.json({ error: msg }, { status: 403 })
    console.error("[study assignments POST]", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
