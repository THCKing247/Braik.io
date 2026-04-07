import { NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth/server-auth"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getUserMembership, requireTeamAccessWithUser } from "@/lib/auth/rbac"
import { getCachedTeamInventoryGetPayload } from "@/lib/teams/cached-team-inventory-get"
import { revalidateTeamInventory } from "@/lib/cache/lightweight-get-cache"
import { isPlayerAssignableBucket } from "@/lib/inventory-category-policy"
import {
  canApproveInventoryConditionReports,
  canSubmitInventoryConditionReport,
} from "@/lib/inventory-condition-permissions"

const INVENTORY_BUCKETS = ["Gear", "Uniforms", "Facilities", "Training Room", "Field"] as const
type InventoryBucket = (typeof INVENTORY_BUCKETS)[number]

function normalizeBucket(v: unknown): InventoryBucket {
  const s = typeof v === "string" ? v.trim() : ""
  if (INVENTORY_BUCKETS.includes(s as InventoryBucket)) return s as InventoryBucket
  return "Gear"
}

function mapItemRow(
  i: Record<string, unknown>,
  playerMap: Map<
    string,
    { id: string; firstName: string; lastName: string; jerseyNumber: number | null }
  >
) {
  const assignedId = (i.assigned_to_player_id as string | null) ?? null
  const p = assignedId ? playerMap.get(assignedId) : undefined
  return {
    id: i.id as string,
    category: (i.category as string) ?? "",
    name: (i.name as string) ?? "",
    quantityTotal: (i.quantity_total as number) ?? 0,
    quantityAvailable: (i.quantity_available as number) ?? 0,
    condition: (i.condition as string) ?? "GOOD",
    assignedToPlayerId: assignedId,
    notes: (i.notes as string | null) ?? null,
    status: (i.status as string) ?? "AVAILABLE",
    equipmentType: (i.equipment_type as string | null) ?? null,
    size: (i.size as string | null) ?? null,
    make: (i.make as string | null) ?? null,
    itemCode: (i.item_code as string | null) ?? null,
    inventoryBucket: normalizeBucket(i.inventory_bucket),
    costPerUnit: i.cost_per_unit != null ? Number(i.cost_per_unit) : null,
    costNotes: (i.cost_notes as string | null) ?? null,
    costUpdatedAt: (i.cost_updated_at as string | null) ?? null,
    damageReportText: (i.damage_report_text as string | null) ?? null,
    damageReportedAt: (i.damage_reported_at as string | null) ?? null,
    damageReportedByPlayerId: (i.damage_reported_by_player_id as string | null) ?? null,
    assignedPlayer: assignedId
      ? p
        ? {
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            jerseyNumber: p.jerseyNumber ?? null,
          }
        : null
      : null,
  }
}

/**
 * GET /api/teams/[teamId]/inventory
 * Returns inventory items and players for the team (InventoryManager shape).
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

    try {
      const { items, players, recentUnitCostChanges } = await getCachedTeamInventoryGetPayload(teamId)
      const membership = await getUserMembership(teamId)
      let pendingConditionReportCount = 0
      if (membership && canApproveInventoryConditionReports(membership)) {
        const supabase = getSupabaseServer()
        const { count } = await supabase
          .from("inventory_condition_reports")
          .select("id", { count: "exact", head: true })
          .eq("team_id", teamId)
          .eq("status", "pending")
        pendingConditionReportCount = count ?? 0
      }
      return NextResponse.json({
        items,
        players,
        recentUnitCostChanges,
        pendingConditionReportCount,
        viewer: membership
          ? {
              canReportCondition: canSubmitInventoryConditionReport(membership),
              canApproveConditionReports: canApproveInventoryConditionReports(membership),
            }
          : { canReportCondition: false, canApproveConditionReports: false },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load inventory"
      console.error("[GET /api/teams/.../inventory]", msg, e)
      return NextResponse.json({ error: "Failed to load inventory", details: msg }, { status: 500 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[GET /api/teams/.../inventory]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST /api/teams/[teamId]/inventory - Create inventory item
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

    const body = await request.json()
    const {
      equipmentType,
      customEquipmentName,
      quantity,
      condition,
      availability,
      assignedToPlayerId,
      notes,
      inventoryBucket,
      costPerUnit,
      itemCode,
    } = body

    if (!equipmentType || !quantity || quantity < 1) {
      return NextResponse.json(
        { error: "equipmentType and quantity (>= 1) are required" },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()

    // Determine category and name
    const category = equipmentType === "CUSTOM" ? "Custom Equipment" : equipmentType
    const baseName = equipmentType === "CUSTOM" && customEquipmentName
      ? customEquipmentName
      : equipmentType
    const bucket = normalizeBucket(inventoryBucket)

    if (assignedToPlayerId && !isPlayerAssignableBucket(bucket)) {
      return NextResponse.json(
        { error: "Only Gear and Uniforms items can be assigned to players." },
        { status: 400 }
      )
    }

    const costNum =
      costPerUnit !== undefined && costPerUnit !== null && costPerUnit !== ""
        ? Number(costPerUnit)
        : null
    const safeCost =
      costNum !== null && !Number.isNaN(costNum) && costNum >= 0 ? costNum : null

    // Get count of existing items of this type to number sequentially
    const { count: existingCount } = await supabase
      .from("inventory_items")
      .select("*", { count: "exact", head: true })
      .eq("team_id", teamId)
      .eq("equipment_type", equipmentType)

    const startNumber = (existingCount || 0) + 1

    // Generate unique item codes
    const generateItemCode = (equipmentType: string, index: number) => {
      const prefix = equipmentType.substring(0, 3).toUpperCase()
      const timestamp = Date.now().toString(36).toUpperCase()
      return `${prefix}-${timestamp}-${String(startNumber + index).padStart(4, "0")}`
    }

    const customCode =
      typeof itemCode === "string" && itemCode.trim() && quantity === 1 ? itemCode.trim() : null
    if (customCode) {
      const { data: dup } = await supabase
        .from("inventory_items")
        .select("id")
        .eq("team_id", teamId)
        .eq("item_code", customCode)
        .maybeSingle()
      if (dup) {
        return NextResponse.json(
          { error: "That item code is already in use on this team." },
          { status: 409 }
        )
      }
    }

    // Create inventory item(s) - if quantity > 1, create multiple items with sequential numbering
    const itemsToCreate = Array.from({ length: quantity }, (_, index) => ({
      team_id: teamId,
      category,
      name: quantity === 1 ? baseName : `${baseName} #${startNumber + index}`,
      quantity_total: 1,
      quantity_available: assignedToPlayerId ? 0 : 1,
      condition: condition || "GOOD",
      status: availability || "AVAILABLE",
      assigned_to_player_id: assignedToPlayerId || null,
      notes: notes || null,
      item_code: customCode ?? generateItemCode(equipmentType, index),
      equipment_type: equipmentType,
      inventory_bucket: bucket,
      cost_per_unit: safeCost,
      cost_notes: null as string | null,
      cost_updated_at: safeCost != null ? new Date().toISOString() : null,
    }))

    const { data: createdItems, error: insertError } = await supabase
      .from("inventory_items")
      .insert(itemsToCreate)
      .select()

    if (insertError) {
      console.error("[POST /api/teams/.../inventory]", insertError)
      return NextResponse.json(
        { error: "Failed to create inventory item", details: insertError.message },
        { status: 500 }
      )
    }

    // Fetch players for response
    const { data: playersData } = await supabase
      .from("players")
      .select("id, first_name, last_name, jersey_number")
      .eq("team_id", teamId)

    const playerMap = new Map(
      (playersData || []).map((p) => [
        p.id,
        {
          id: p.id,
          firstName: p.first_name ?? "",
          lastName: p.last_name ?? "",
          jerseyNumber: p.jersey_number ?? null,
        },
      ])
    )

    const formattedItems = (createdItems || []).map((item) =>
      mapItemRow(item as unknown as Record<string, unknown>, playerMap)
    )

    revalidateTeamInventory(teamId)

    // If multiple items created, return the first one (for compatibility)
    return NextResponse.json(formattedItems[0] || formattedItems)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Access denied"
    if (message.includes("Access denied") || message.includes("Not a member")) {
      return NextResponse.json({ error: message }, { status: 403 })
    }
    console.error("[POST /api/teams/.../inventory]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
