import { getSupabaseServer } from "@/src/lib/supabaseServer"
import {
  lightweightCached,
  LW_TTL_TEAM_INVENTORY,
  tagTeamInventory,
} from "@/lib/cache/lightweight-get-cache"
import { normalizeInventoryBucketLabel } from "@/lib/inventory-category-policy"

const INVENTORY_BUCKETS = ["Gear", "Uniforms", "Facilities", "Training Room", "Field"] as const
type InventoryBucket = (typeof INVENTORY_BUCKETS)[number]

function normalizeBucket(v: unknown): InventoryBucket {
  const s = typeof v === "string" ? v.trim() : ""
  if (INVENTORY_BUCKETS.includes(s as InventoryBucket)) return s as InventoryBucket
  return "Gear"
}

function typeCostKey(bucket: string, equipmentType: string): string {
  return `${normalizeInventoryBucketLabel(bucket)}|${equipmentType.trim() || "Other"}`
}

export type UnitCostChangeEvent = {
  inventoryBucket: string
  equipmentType: string
  newCost: number | null
  changedAt: string
}

function mapItemRow(
  i: Record<string, unknown>,
  playerMap: Map<string, { id: string; firstName: string; lastName: string; jerseyNumber: number | null }>,
  unitCostByKey: Map<string, { unitCost: number | null; updatedAt: string | null; notes: string | null }>
) {
  const assignedId = (i.assigned_to_player_id as string | null) ?? null
  const p = assignedId ? playerMap.get(assignedId) : undefined
  const bucket = normalizeBucket(i.inventory_bucket)
  const et = ((i.equipment_type as string | null) ?? (i.category as string) ?? "").trim() || "Other"
  const tc = unitCostByKey.get(typeCostKey(bucket, et))
  const rowCost = i.cost_per_unit != null ? Number(i.cost_per_unit) : null
  const hasTypeCost = unitCostByKey.has(typeCostKey(bucket, et))
  const mergedCost = hasTypeCost ? (tc?.unitCost ?? null) : rowCost
  const mergedUpdated = hasTypeCost
    ? tc?.updatedAt ?? null
    : (i.cost_updated_at as string | null) ?? null
  const mergedCostNotes = hasTypeCost ? tc?.notes ?? null : ((i.cost_notes as string | null) ?? null)

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
    inventoryBucket: bucket,
    costPerUnit: mergedCost != null && !Number.isNaN(mergedCost) ? mergedCost : null,
    costNotes: mergedCostNotes,
    costUpdatedAt: mergedUpdated,
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

export type TeamInventoryGetPayload = {
  items: ReturnType<typeof mapItemRow>[]
  players: Array<{ id: string; firstName: string; lastName: string; jerseyNumber: number | null }>
  recentUnitCostChanges: UnitCostChangeEvent[]
}

async function loadTeamInventoryGetPayload(teamId: string): Promise<TeamInventoryGetPayload> {
  const supabase = getSupabaseServer()
  const [itemsRes, playersRes, costsRes, eventsRes] = await Promise.all([
    supabase
      .from("inventory_items")
      .select(
        "id, category, name, quantity_total, quantity_available, condition, assigned_to_player_id, notes, status, equipment_type, size, make, item_code, inventory_bucket, cost_per_unit, cost_notes, cost_updated_at, damage_report_text, damage_reported_at, damage_reported_by_player_id"
      )
      .eq("team_id", teamId)
      .order("name", { ascending: true }),
    supabase
      .from("players")
      .select("id, first_name, last_name, jersey_number")
      .eq("team_id", teamId)
      .order("last_name", { ascending: true }),
    supabase
      .from("inventory_unit_costs")
      .select("inventory_bucket, equipment_type, unit_cost, notes, updated_at")
      .eq("team_id", teamId),
    supabase
      .from("inventory_unit_cost_events")
      .select("inventory_bucket, equipment_type, new_cost, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(3),
  ])

  if (itemsRes.error) {
    throw new Error(itemsRes.error.message || "inventory_items query failed")
  }
  if (playersRes.error) {
    throw new Error(playersRes.error.message || "players query failed")
  }
  if (costsRes.error) {
    throw new Error(costsRes.error.message || "inventory_unit_costs query failed")
  }
  if (eventsRes.error) {
    throw new Error(eventsRes.error.message || "inventory_unit_cost_events query failed")
  }

  const unitCostByKey = new Map<string, { unitCost: number | null; updatedAt: string | null; notes: string | null }>()
  for (const row of costsRes.data ?? []) {
    const r = row as {
      inventory_bucket: string
      equipment_type: string
      unit_cost: number | null
      notes: string | null
      updated_at: string
    }
    unitCostByKey.set(typeCostKey(r.inventory_bucket, r.equipment_type), {
      unitCost: r.unit_cost != null ? Number(r.unit_cost) : null,
      updatedAt: r.updated_at ?? null,
      notes: r.notes ?? null,
    })
  }

  const players = (playersRes.data ?? []).map((p) => ({
    id: p.id,
    firstName: p.first_name ?? "",
    lastName: p.last_name ?? "",
    jerseyNumber: p.jersey_number ?? null,
  }))
  const playerMap = new Map(players.map((p) => [p.id, p]))
  const items = (itemsRes.data ?? []).map((i) => mapItemRow(i as Record<string, unknown>, playerMap, unitCostByKey))

  const recentUnitCostChanges: UnitCostChangeEvent[] = (eventsRes.data ?? []).map((e) => {
    const row = e as { inventory_bucket: string; equipment_type: string; new_cost: number | null; created_at: string }
    return {
      inventoryBucket: row.inventory_bucket,
      equipmentType: row.equipment_type,
      newCost: row.new_cost != null ? Number(row.new_cost) : null,
      changedAt: row.created_at,
    }
  })

  return { items, players, recentUnitCostChanges }
}

export function getCachedTeamInventoryGetPayload(teamId: string): Promise<TeamInventoryGetPayload> {
  return lightweightCached(
    ["team-inventory-get-v2", teamId],
    { revalidate: LW_TTL_TEAM_INVENTORY, tags: [tagTeamInventory(teamId)] },
    () => loadTeamInventoryGetPayload(teamId)
  )
}
