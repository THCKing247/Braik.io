import { NextResponse } from "next/server"
import { getServerSession, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { requireTeamPermission } from "@/lib/auth/rbac"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function isValidUuid(s: string): boolean {
  return s.length > 0 && UUID_REGEX.test(s)
}

/**
 * PATCH /api/plays/reorder
 * Body: { items: Array<{ id: string, orderIndex: number }> }
 * Updates order_index for each play. All plays must belong to the same team and same parent scope
 * (playbook_id, formation_id, sub_formation_id). Safe when order_index column is missing: returns 500.
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const items = Array.isArray(body?.items) ? body.items : []
    if (items.length === 0) {
      return NextResponse.json({ error: "items array is required" }, { status: 400 })
    }

    const parsed = items
      .map((x: unknown) => {
        if (x && typeof x === "object" && "id" in x && "orderIndex" in x) {
          const id = String((x as { id: unknown }).id)
          const orderIndex = Number((x as { orderIndex: unknown }).orderIndex)
          if (isValidUuid(id) && Number.isInteger(orderIndex) && orderIndex >= 0) return { id, orderIndex }
        }
        return null
      })
      .filter((x): x is { id: string; orderIndex: number } => x != null)

    if (parsed.length === 0) {
      return NextResponse.json({ error: "Valid items (id, orderIndex) required" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const playIds = parsed.map((p) => p.id)

    const { data: plays, error: fetchError } = await supabase
      .from("plays")
      .select("id, team_id, playbook_id, formation_id, sub_formation_id, side")
      .in("id", playIds)

    if (fetchError || !plays?.length) {
      return NextResponse.json({ error: "Plays not found" }, { status: 404 })
    }

    const teamId = plays[0].team_id
    const playbookId = plays[0].playbook_id ?? null
    const formationId = (plays[0] as { formation_id?: string }).formation_id ?? null

    // Scope: same team, playbook, and formation (sub_formation_id can differ for formation-level reorder).
    const sameScope = plays.every(
      (p) =>
        p.team_id === teamId &&
        (p.playbook_id ?? null) === playbookId &&
        ((p as { formation_id?: string }).formation_id ?? null) === formationId
    )
    if (!sameScope) {
      return NextResponse.json({ error: "All plays must be in the same playbook/formation" }, { status: 400 })
    }

    if (plays.length !== playIds.length) {
      return NextResponse.json({ error: "Some play ids not found" }, { status: 404 })
    }

    const side = plays[0].side as string
    if (side === "offense") {
      await requireTeamPermission(teamId, "edit_offense_plays")
    } else if (side === "defense") {
      await requireTeamPermission(teamId, "edit_defense_plays")
    } else {
      await requireTeamPermission(teamId, "edit_special_teams_plays")
    }

    for (const { id, orderIndex } of parsed) {
      const { error: updateError } = await supabase
        .from("plays")
        .update({ order_index: orderIndex, updated_at: new Date().toISOString() })
        .eq("id", id)
      if (updateError) {
        const msg = updateError.message ?? "Could not reorder plays"
        const code = (updateError as { code?: string }).code
        if (process.env.NODE_ENV !== "production") {
          console.error("[PATCH /api/plays/reorder]", { message: msg, code, details: updateError })
        }
        return NextResponse.json({ error: "Could not reorder plays" }, { status: 500 })
      }
    }

    const res = NextResponse.json({ success: true })
    if (session.refreshedSession) applyRefreshedSessionCookies(res, session.refreshedSession)
    return res
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error("[PATCH /api/plays/reorder]", error)
    return NextResponse.json(
      { error: err?.message ?? "Could not reorder plays" },
      { status: err?.message?.includes("Access denied") ? 403 : 500 }
    )
  }
}
