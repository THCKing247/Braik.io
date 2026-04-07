import type { SupabaseClient } from "@supabase/supabase-js"

const BUCKETS = ["Gear", "Uniforms", "Facilities", "Training Room", "Field"] as const
type InventoryBucket = (typeof BUCKETS)[number]

function normalizeBucket(v: unknown): InventoryBucket {
  const s = typeof v === "string" ? v.trim() : ""
  if (BUCKETS.includes(s as InventoryBucket)) return s as InventoryBucket
  return "Gear"
}

export type InventoryCatalogCardRow = {
  inventoryBucket: InventoryBucket
  equipmentTypeKey: string
  displayName: string
  iconKey: string | null
  typeId: string | null
  assignedCount: number
  totalCount: number
  dominantConditionLabel: string
}

function conditionLabel(raw: string): string {
  const u = raw.toUpperCase()
  if (u === "EXCELLENT") return "Excellent"
  if (u === "GOOD") return "Good"
  if (u === "FAIR") return "Fair"
  if (u === "POOR" || u === "REPLACE" || u === "NEEDS_REPAIR" || u === "NEEDS_REPLACEMENT") return "Poor"
  return raw.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

function dominantCondition(conditions: string[]): string {
  const counts = new Map<string, number>()
  for (const c of conditions) {
    const k = c || "GOOD"
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  let best = "GOOD"
  let n = -1
  for (const [k, v] of counts) {
    if (v > n) {
      n = v
      best = k
    }
  }
  return conditionLabel(best)
}

/**
 * Aggregates active inventory rows into catalog cards (one per bucket + equipment type).
 */
export async function loadInventoryCatalog(
  supabase: SupabaseClient,
  teamId: string,
  bucketFilter: string
): Promise<InventoryCatalogCardRow[]> {
  let q = supabase
    .from("inventory_items")
    .select("inventory_bucket, equipment_type, category, condition, assigned_to_player_id")
    .eq("team_id", teamId)
    .eq("archive_status", "active")

  if (bucketFilter && bucketFilter !== "All") {
    q = q.eq("inventory_bucket", bucketFilter)
  }

  const { data: itemRows, error: itemErr } = await q
  if (itemErr) throw new Error(itemErr.message)

  const { data: typeRows, error: typeErr } = await supabase
    .from("inventory_item_types")
    .select("id, inventory_bucket, equipment_type_key, display_name, icon_key")
    .eq("team_id", teamId)
    .is("archived_at", null)

  if (typeErr) throw new Error(typeErr.message)

  const typeMeta = new Map<string, { id: string; displayName: string | null; iconKey: string | null }>()
  for (const r of typeRows ?? []) {
    const row = r as {
      id: string
      inventory_bucket: string
      equipment_type_key: string
      display_name: string | null
      icon_key: string | null
    }
    typeMeta.set(`${row.inventory_bucket}|||${row.equipment_type_key}`, {
      id: row.id,
      displayName: row.display_name,
      iconKey: row.icon_key,
    })
  }

  type Agg = {
    bucket: InventoryBucket
    key: string
    assigned: number
    total: number
    conditions: string[]
  }
  const groups = new Map<string, Agg>()

  for (const raw of itemRows ?? []) {
    const i = raw as {
      inventory_bucket: string | null
      equipment_type: string | null
      category: string | null
      condition: string | null
      assigned_to_player_id: string | null
    }
    const bucket = normalizeBucket(i.inventory_bucket)
    const key = ((i.equipment_type ?? i.category ?? "") as string).trim() || "Other"
    const gk = `${bucket}|||${key}`
    let g = groups.get(gk)
    if (!g) {
      g = { bucket, key, assigned: 0, total: 0, conditions: [] }
      groups.set(gk, g)
    }
    g.total += 1
    if (i.assigned_to_player_id) g.assigned += 1
    g.conditions.push(i.condition || "GOOD")
  }

  const out: InventoryCatalogCardRow[] = []
  for (const g of groups.values()) {
    const meta = typeMeta.get(`${g.bucket}|||${g.key}`)
    out.push({
      inventoryBucket: g.bucket,
      equipmentTypeKey: g.key,
      displayName: (meta?.displayName ?? g.key).trim() || g.key,
      iconKey: meta?.iconKey ?? null,
      typeId: meta?.id ?? null,
      assignedCount: g.assigned,
      totalCount: g.total,
      dominantConditionLabel: dominantCondition(g.conditions),
    })
  }

  out.sort((a, b) => a.displayName.localeCompare(b.displayName))
  return out
}

export async function loadInventoryArchiveAssignments(
  supabase: SupabaseClient,
  teamId: string,
  inventoryBucket: string,
  equipmentTypeKey: string
): Promise<
  {
    itemId: string
    itemName: string
    player: { id: string; firstName: string; lastName: string; jerseyNumber: number | null }
  }[]
> {
  const typeOr = `equipment_type.eq.${equipmentTypeKey},category.eq.${equipmentTypeKey}`
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, name, assigned_to_player_id")
    .eq("team_id", teamId)
    .eq("archive_status", "active")
    .eq("inventory_bucket", inventoryBucket)
    .or(typeOr)
    .not("assigned_to_player_id", "is", null)

  if (error) throw new Error(error.message)

  const rows = data ?? []
  const ids = [...new Set(rows.map((r) => (r as { assigned_to_player_id: string }).assigned_to_player_id))]
  if (ids.length === 0) return []

  const { data: players, error: pErr } = await supabase
    .from("players")
    .select("id, first_name, last_name, jersey_number")
    .eq("team_id", teamId)
    .in("id", ids)

  if (pErr) throw new Error(pErr.message)

  const pmap = new Map<string, { id: string; firstName: string; lastName: string; jerseyNumber: number | null }>()
  for (const p of players ?? []) {
    const pl = p as {
      id: string
      first_name: string | null
      last_name: string | null
      jersey_number: number | null
    }
    pmap.set(pl.id, {
      id: pl.id,
      firstName: pl.first_name ?? "",
      lastName: pl.last_name ?? "",
      jerseyNumber: pl.jersey_number ?? null,
    })
  }

  return rows.map((r) => {
    const row = r as { id: string; name: string; assigned_to_player_id: string }
    const pl = pmap.get(row.assigned_to_player_id)
    return {
      itemId: row.id,
      itemName: row.name,
      player: pl ?? { id: row.assigned_to_player_id, firstName: "", lastName: "", jerseyNumber: null },
    }
  })
}
