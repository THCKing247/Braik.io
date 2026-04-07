import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUserMembership, requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { ROLES } from "@/lib/auth/roles"
import { revalidateTeamInventory } from "@/lib/cache/lightweight-get-cache"
import { recalcInventoryTypeTotalsForTeam } from "@/lib/inventory/recalc-inventory-type-totals"

const BUCKETS = ["Gear", "Uniforms", "Facilities", "Training Room", "Field"] as const

/**
 * GET /api/teams/[teamId]/inventory/equipment-batches
 * Query: inventoryBucket, equipmentType (optional filters)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }
    await requireTeamAccessWithUser(teamId, session.user)
    const supabase = getSupabaseServer()
    let q = supabase.from("equipment_batches").select("*").eq("team_id", teamId).order("created_at", { ascending: false })
    const { data, error } = await q
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ batches: data ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[equipment-batches GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST — Head Coach only: create batch (+ optional line items)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const { teamId } = await params
    if (!teamId) {
      return NextResponse.json({ error: "teamId is required" }, { status: 400 })
    }
    await requireTeamAccessWithUser(teamId, session.user)
    const membership = await getUserMembership(teamId)
    if (!membership || membership.role !== ROLES.HEAD_COACH) {
      return NextResponse.json({ error: "Only the head coach can add equipment batches." }, { status: 403 })
    }

    const body = await request.json()
    const inventoryBucket = typeof body.inventoryBucket === "string" ? body.inventoryBucket.trim() : ""
    const equipmentType = typeof body.equipmentType === "string" ? body.equipmentType.trim() : ""
    const quantity = Math.max(1, parseInt(String(body.quantity), 10) || 1)
    const unitCost = body.unitCost != null ? Number(body.unitCost) : 0
    const purchaseDate = body.purchaseDate ? String(body.purchaseDate) : null
    const conditionAtPurchase = typeof body.conditionAtPurchase === "string" ? body.conditionAtPurchase : "EXCELLENT"
    const currentCondition = typeof body.currentCondition === "string" ? body.currentCondition : conditionAtPurchase
    const status = typeof body.status === "string" ? body.status : "active"
    const notes = typeof body.notes === "string" ? body.notes.trim() || null : null

    if (!BUCKETS.includes(inventoryBucket as (typeof BUCKETS)[number]) || !equipmentType) {
      return NextResponse.json({ error: "inventoryBucket and equipmentType are required" }, { status: 400 })
    }
    if (Number.isNaN(unitCost) || unitCost < 0) {
      return NextResponse.json({ error: "unitCost must be a non-negative number" }, { status: 400 })
    }
    if (!["active", "phasing_out", "retired"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const supabase = getSupabaseServer()
    const { data: batch, error: insErr } = await supabase
      .from("equipment_batches")
      .insert({
        team_id: teamId,
        inventory_bucket: inventoryBucket,
        equipment_type: equipmentType,
        quantity,
        purchase_date: purchaseDate,
        unit_cost: unitCost,
        condition_at_purchase: conditionAtPurchase,
        current_condition: currentCondition,
        status,
        notes,
        created_by: session.user.id,
      })
      .select()
      .single()

    if (insErr || !batch) {
      console.error("[equipment-batches POST]", insErr)
      return NextResponse.json({ error: "Failed to create batch" }, { status: 500 })
    }

    const batchRow = batch as { id: string }
    const createItems = body.createItems === true
    if (createItems && status !== "retired") {
      const rows = Array.from({ length: quantity }, (_, i) => ({
        team_id: teamId,
        category: equipmentType,
        name: quantity === 1 ? equipmentType : `${equipmentType} #${i + 1}`,
        quantity_total: 1,
        quantity_available: 1,
        condition: currentCondition,
        status: "AVAILABLE",
        equipment_type: equipmentType,
        inventory_bucket: inventoryBucket,
        equipment_batch_id: batchRow.id,
        cost_per_unit: unitCost,
        cost_updated_at: new Date().toISOString(),
      }))
      const { error: itemErr } = await supabase.from("inventory_items").insert(rows)
      if (itemErr) {
        console.error("[equipment-batches POST] items", itemErr)
      }
    }

    try {
      await recalcInventoryTypeTotalsForTeam(supabase, teamId)
    } catch (e) {
      console.error("[equipment-batches POST] recalc", e)
    }
    revalidateTeamInventory(teamId)
    return NextResponse.json({ batch })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[equipment-batches POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
