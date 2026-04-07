import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUserMembership, requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { canEditRoster } from "@/lib/auth/roles"
import { revalidateTeamInventory } from "@/lib/cache/lightweight-get-cache"

const BUCKETS = ["Gear", "Uniforms", "Facilities", "Training Room", "Field"] as const

/**
 * POST /api/teams/[teamId]/inventory/unit-costs
 * Upsert per–item-type unit cost (one row per team + bucket + equipment type).
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
    if (!membership || !canEditRoster(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const inventoryBucket = typeof body.inventoryBucket === "string" ? body.inventoryBucket.trim() : ""
    const equipmentType = typeof body.equipmentType === "string" ? body.equipmentType.trim() : ""
    if (!inventoryBucket || !BUCKETS.includes(inventoryBucket as (typeof BUCKETS)[number])) {
      return NextResponse.json({ error: "Valid inventoryBucket is required" }, { status: 400 })
    }
    if (!equipmentType) {
      return NextResponse.json({ error: "equipmentType is required" }, { status: 400 })
    }

    let unitCost: number | null = null
    if (body.unitCost !== undefined && body.unitCost !== null && body.unitCost !== "") {
      const n = Number(body.unitCost)
      if (Number.isNaN(n) || n < 0) {
        return NextResponse.json({ error: "unitCost must be a non-negative number" }, { status: 400 })
      }
      unitCost = n
    }

    const notes =
      typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 2000) : null

    const supabase = getSupabaseServer()

    const { data: prev } = await supabase
      .from("inventory_unit_costs")
      .select("unit_cost")
      .eq("team_id", teamId)
      .eq("inventory_bucket", inventoryBucket)
      .eq("equipment_type", equipmentType)
      .maybeSingle()

    const previousCost =
      prev && (prev as { unit_cost?: number | null }).unit_cost != null
        ? Number((prev as { unit_cost: number }).unit_cost)
        : null

    const now = new Date().toISOString()
    const { error: upsertErr } = await supabase.from("inventory_unit_costs").upsert(
      {
        team_id: teamId,
        inventory_bucket: inventoryBucket,
        equipment_type: equipmentType,
        unit_cost: unitCost,
        notes,
        updated_at: now,
        updated_by: session.user.id,
      },
      { onConflict: "team_id,inventory_bucket,equipment_type" as never }
    )

    if (upsertErr) {
      console.error("[POST unit-costs]", upsertErr)
      return NextResponse.json({ error: "Failed to save unit cost" }, { status: 500 })
    }

    const { error: evErr } = await supabase.from("inventory_unit_cost_events").insert({
      team_id: teamId,
      inventory_bucket: inventoryBucket,
      equipment_type: equipmentType,
      previous_cost: previousCost,
      new_cost: unitCost,
      changed_by: session.user.id,
    })

    if (evErr) {
      console.error("[POST unit-costs] event", evErr)
    }

    revalidateTeamInventory(teamId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST unit-costs]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
