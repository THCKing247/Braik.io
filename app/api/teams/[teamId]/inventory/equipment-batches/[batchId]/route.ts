import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUserMembership, requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { ROLES } from "@/lib/auth/roles"
import { revalidateTeamInventory } from "@/lib/cache/lightweight-get-cache"
import { recalcInventoryTypeTotalsForTeam } from "@/lib/inventory/recalc-inventory-type-totals"

/**
 * PATCH — Head Coach only: update batch status / condition / notes; retiring zeros availability on linked items.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string; batchId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { teamId, batchId } = await params
    if (!teamId || !batchId) {
      return NextResponse.json({ error: "teamId and batchId are required" }, { status: 400 })
    }
    await requireTeamAccessWithUser(teamId, session.user)
    const membership = await getUserMembership(teamId)
    if (!membership || membership.role !== ROLES.HEAD_COACH) {
      return NextResponse.json({ error: "Only the head coach can update equipment batches." }, { status: 403 })
    }

    const body = await request.json()
    const supabase = getSupabaseServer()

    const { data: existing, error: exErr } = await supabase
      .from("equipment_batches")
      .select("id, team_id")
      .eq("id", batchId)
      .eq("team_id", teamId)
      .maybeSingle()

    if (exErr || !existing) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 })
    }

    const update: Record<string, unknown> = {}
    if (body.status !== undefined) {
      const s = String(body.status)
      if (!["active", "phasing_out", "retired"].includes(s)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }
      update.status = s
    }
    if (body.currentCondition !== undefined) update.current_condition = String(body.currentCondition)
    if (body.notes !== undefined) update.notes = typeof body.notes === "string" ? body.notes.trim() || null : null

    const { data: updated, error: upErr } = await supabase
      .from("equipment_batches")
      .update(update)
      .eq("id", batchId)
      .select()
      .single()

    if (upErr) {
      return NextResponse.json({ error: "Failed to update batch" }, { status: 500 })
    }

    if (body.status === "retired" || (updated as { status?: string }).status === "retired") {
      await supabase
        .from("inventory_items")
        .update({ quantity_available: 0, status: "UNAVAILABLE" })
        .eq("equipment_batch_id", batchId)
        .eq("team_id", teamId)
    }

    try {
      await recalcInventoryTypeTotalsForTeam(supabase, teamId)
    } catch (e) {
      console.error("[batch PATCH] recalc", e)
    }
    revalidateTeamInventory(teamId)
    return NextResponse.json({ batch: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[equipment-batches PATCH]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
