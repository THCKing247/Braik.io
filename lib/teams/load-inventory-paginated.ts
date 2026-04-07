import type { SupabaseClient } from "@supabase/supabase-js"
import { normalizeInventoryBucketLabel } from "@/lib/inventory-category-policy"

const BUCKETS = ["Gear", "Uniforms", "Facilities", "Training Room", "Field"] as const
type InventoryBucket = (typeof BUCKETS)[number]

function normalizeBucket(v: unknown): InventoryBucket {
  const s = typeof v === "string" ? v.trim() : ""
  if (BUCKETS.includes(s as InventoryBucket)) return s as InventoryBucket
  return "Gear"
}

function typeCostKey(bucket: string, equipmentType: string): string {
  return `${normalizeInventoryBucketLabel(bucket)}|${equipmentType.trim() || "Other"}`
}

export type PaginatedInventoryItemRow = {
  id: string
  category: string
  name: string
  quantityTotal: number
  quantityAvailable: number
  condition: string
  assignedToPlayerId: string | null
  notes: string | null
  status: string
  equipmentType: string | null
  size: string | null
  make: string | null
  itemCode: string | null
  inventoryBucket: InventoryBucket
  costPerUnit: number | null
  costNotes: string | null
  costUpdatedAt: string | null
  damageReportText: string | null
  damageReportedAt: string | null
  damageReportedByPlayerId: string | null
  equipmentBatchId: string | null
  equipmentBatchStatus: string | null
}

function mapRow(
  i: Record<string, unknown>,
  unitCostByKey: Map<string, { unitCost: number | null; updatedAt: string | null; notes: string | null }>,
  batchStatusById: Map<string, string>
): PaginatedInventoryItemRow {
  const bucket = normalizeBucket(i.inventory_bucket)
  const et = ((i.equipment_type as string | null) ?? (i.category as string) ?? "").trim() || "Other"
  const tc = unitCostByKey.get(typeCostKey(bucket, et))
  const rowCost = i.cost_per_unit != null ? Number(i.cost_per_unit) : null
  const hasTypeCost = unitCostByKey.has(typeCostKey(bucket, et))
  const mergedCost = hasTypeCost ? tc?.unitCost ?? null : rowCost
  const mergedUpdated = hasTypeCost ? tc?.updatedAt ?? null : (i.cost_updated_at as string | null) ?? null
  const mergedCostNotes = hasTypeCost ? tc?.notes ?? null : ((i.cost_notes as string | null) ?? null)
  const bid = (i.equipment_batch_id as string | null) ?? null
  return {
    id: i.id as string,
    category: (i.category as string) ?? "",
    name: (i.name as string) ?? "",
    quantityTotal: (i.quantity_total as number) ?? 0,
    quantityAvailable: (i.quantity_available as number) ?? 0,
    condition: (i.condition as string) ?? "GOOD",
    assignedToPlayerId: (i.assigned_to_player_id as string | null) ?? null,
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
    equipmentBatchId: bid,
    equipmentBatchStatus: bid ? batchStatusById.get(bid) ?? null : null,
  }
}

export async function loadInventoryPage(
  supabase: SupabaseClient,
  teamId: string,
  opts: {
    page: number
    pageSize: number
    bucketFilter: string
    search: string
    /** When set, only rows matching this equipment type (or category) are returned. */
    equipmentTypeFilter?: string | null
  }
): Promise<{ items: PaginatedInventoryItemRow[]; totalCount: number; assignments: Record<string, { id: string; firstName: string; lastName: string; jerseyNumber: number | null }> }> {
  const { page, pageSize, bucketFilter, search, equipmentTypeFilter } = opts
  const from = Math.max(0, (page - 1) * pageSize)
  const to = from + pageSize - 1

  const qtermRaw = search.trim().replace(/%/g, "")
  const orFilter =
    qtermRaw.length > 0
      ? `name.ilike.%${qtermRaw}%,item_code.ilike.%${qtermRaw}%,equipment_type.ilike.%${qtermRaw}%,category.ilike.%${qtermRaw}%`
      : null

  let countQ = supabase
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .eq("archive_status", "active")
  let dataQ = supabase
    .from("inventory_items")
    .select(
      "id, category, name, quantity_total, quantity_available, condition, assigned_to_player_id, notes, status, equipment_type, size, make, item_code, inventory_bucket, cost_per_unit, cost_notes, cost_updated_at, damage_report_text, damage_reported_at, damage_reported_by_player_id, equipment_batch_id, archive_status"
    )
    .eq("team_id", teamId)
    .eq("archive_status", "active")
  if (bucketFilter && bucketFilter !== "All") {
    countQ = countQ.eq("inventory_bucket", bucketFilter)
    dataQ = dataQ.eq("inventory_bucket", bucketFilter)
  }
  const et = equipmentTypeFilter?.trim()
  if (et) {
    const typeOr = `equipment_type.eq.${et},category.eq.${et}`
    countQ = countQ.or(typeOr)
    dataQ = dataQ.or(typeOr)
  }
  if (orFilter) {
    countQ = countQ.or(orFilter)
    dataQ = dataQ.or(orFilter)
  }

  const [costsRes, countRes, dataRes] = await Promise.all([
    supabase
      .from("inventory_unit_costs")
      .select("inventory_bucket, equipment_type, unit_cost, notes, updated_at")
      .eq("team_id", teamId),
    countQ,
    dataQ.order("name", { ascending: true }).range(from, to),
  ])

  if (costsRes.error) throw new Error(costsRes.error.message)

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

  if (countRes.error) throw new Error(countRes.error.message)
  if (dataRes.error) throw new Error(dataRes.error.message)

  const rows = (dataRes.data ?? []) as Record<string, unknown>[]
  const batchIds = [...new Set(rows.map((r) => r.equipment_batch_id as string | null).filter(Boolean))] as string[]

  const batchStatusById = new Map<string, string>()
  if (batchIds.length > 0) {
    const { data: batches, error: bErr } = await supabase
      .from("equipment_batches")
      .select("id, status")
      .in("id", batchIds)
    if (bErr) throw new Error(bErr.message)
    for (const b of batches ?? []) {
      const row = b as { id: string; status: string }
      batchStatusById.set(row.id, row.status)
    }
  }

  const items = rows.map((i) => mapRow(i, unitCostByKey, batchStatusById))

  const assignedIds = [
    ...new Set(items.map((i) => i.assignedToPlayerId).filter(Boolean) as string[]),
  ]
  const assignments: Record<
    string,
    { id: string; firstName: string; lastName: string; jerseyNumber: number | null }
  > = {}
  if (assignedIds.length > 0) {
    const { data: players, error: pErr } = await supabase
      .from("players")
      .select("id, first_name, last_name, jersey_number")
      .eq("team_id", teamId)
      .in("id", assignedIds)
    if (pErr) throw new Error(pErr.message)
    for (const p of players ?? []) {
      const pl = p as {
        id: string
        first_name: string | null
        last_name: string | null
        jersey_number: number | null
      }
      assignments[pl.id] = {
        id: pl.id,
        firstName: pl.first_name ?? "",
        lastName: pl.last_name ?? "",
        jerseyNumber: pl.jersey_number ?? null,
      }
    }
  }

  return {
    items,
    totalCount: countRes.count ?? 0,
    assignments,
  }
}
